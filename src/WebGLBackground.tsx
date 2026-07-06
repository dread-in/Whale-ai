import React, { useEffect, useRef } from 'react';

export default function WebGLBackground({ blurred }: { blurred: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vsSource = `
        attribute vec4 aVertexPosition;
        void main() { gl_Position = aVertexPosition; }
    `;

    const fsSource = `
        precision highp float;
        
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec3 u_weights;

        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

        float snoise(vec2 v){
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy) );
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {
            vec2 st = gl_FragCoord.xy / u_resolution.xy;
            st.x *= u_resolution.x / u_resolution.y;
            vec2 stCentered = st - vec2((u_resolution.x / u_resolution.y) * 0.5, 0.5);
            
            float t = u_time * 0.3;
            vec3 bg = vec3(0.9, 0.9, 0.88);
            float n = snoise(stCentered * 4.0 + vec2(t * 0.2, t * -0.1));
            float yDist = stCentered.y + n * 0.1;
            
            float lBase = sin(yDist * 250.0 + t * 8.0);
            float mask = smoothstep(-0.2, 0.2, lBase);
            
            vec3 darkLine = vec3(0.1, 0.1, 0.1);

            vec3 col = mix(bg, darkLine, 1.0 - mask);
            
            col = mix(col, bg, length(stCentered) * 1.2);

            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function loadShader(gl: WebGLRenderingContext, type: number, source: string) {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1,1, -1,1, 1,-1, -1,-1]), gl.STATIC_DRAW);

    const locs = {
        pos: gl.getAttribLocation(program, 'aVertexPosition'),
        res: gl.getUniformLocation(program, 'u_resolution'),
        time: gl.getUniformLocation(program, 'u_time'),
        weights: gl.getUniformLocation(program, 'u_weights')
    };

    function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }
    }

    function getWeights(now: number) {
        const cycle = 24.0;
        const t = now % cycle;
        let w1 = 0, w2 = 0, w3 = 0;
        
        if (t < 5.0) { w1 = 1; }
        else if (t < 8.0) { w2 = (t - 5.0) / 3.0; w1 = 1.0 - w2; }
        else if (t < 13.0) { w2 = 1; }
        else if (t < 16.0) { w3 = (t - 13.0) / 3.0; w2 = 1.0 - w3; }
        else if (t < 21.0) { w3 = 1; }
        else if (t < 24.0) { w1 = (t - 21.0) / 3.0; w3 = 1.0 - w1; }
        return [w1, w2, w3];
    }

    let animationFrameId: number;

    function render(now: number) {
        now *= 0.001; 
        if (!canvas) return;
        
        resizeCanvasToDisplaySize(canvas);
        gl!.viewport(0, 0, canvas.width, canvas.height);
        
        gl!.useProgram(program);
        gl!.bindBuffer(gl!.ARRAY_BUFFER, positionBuffer);
        gl!.vertexAttribPointer(locs.pos, 2, gl!.FLOAT, false, 0, 0);
        gl!.enableVertexAttribArray(locs.pos);

        const [w1, w2, w3] = getWeights(now);

        gl!.uniform2f(locs.res, canvas.width, canvas.height);
        gl!.uniform1f(locs.time, now);
        gl!.uniform3f(locs.weights, w1, w2, w3);

        gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
        animationFrameId = requestAnimationFrame(render);
    }
    
    animationFrameId = requestAnimationFrame(render);

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      id="glcanvas" 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-[80%] z-10 transition-[filter] duration-500 ease-in-out"
      style={{ 
        filter: blurred ? 'blur(16px)' : 'none',
        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)'
      }} 
    />
  );
}
