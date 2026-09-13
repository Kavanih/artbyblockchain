"use client";

import { useEffect, useRef, useState } from "react";
import { Params, compile, programToGlsl } from "@slotart/engine";

interface Props {
  params: Params;
  width: number;
  height: number;
  className?: string;
  onError?: (msg: string | null) => void;
}

const VERT = `#version 300 es
in vec2 a_pos;
void main(){gl_Position=vec4(a_pos,0.0,1.0);}`;

// Renders the compiled GLSL for a parameter set with WebGL2.
export function FormulaCanvas({ params, width, height, className, onError }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
    if (!gl) {
      setError("WebGL2 is not available in this browser.");
      onError?.("WebGL2 is not available in this browser.");
      return;
    }
    let source = "";
    try {
      source = programToGlsl(compile(params));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onError?.(msg);
      return;
    }
    const compileShader = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh) ?? "shader compile failed";
        gl.deleteShader(sh);
        throw new Error(log);
      }
      return sh;
    };
    let program: WebGLProgram | null = null;
    try {
      const vs = compileShader(gl.VERTEX_SHADER, VERT);
      const fs = compileShader(gl.FRAGMENT_SHADER, source);
      program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
      }
      gl.useProgram(program);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), width, height);
      gl.viewport(0, 0, width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      setError(null);
      onError?.(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onError?.(msg);
    }
    return () => {
      if (program) gl.deleteProgram(program);
    };
  }, [params, width, height, onError]);

  return (
    <div className={className}>
      <canvas
        ref={ref}
        width={width}
        height={height}
        data-testid="formula-canvas"
        className="block w-full rounded-md"
        style={{ aspectRatio: `${width} / ${height}` }}
      />
      {error && <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div>}
    </div>
  );
}