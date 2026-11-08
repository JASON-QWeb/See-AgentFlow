export const ringVertex = `#version 300 es
precision highp float;
in vec2 a_uv;
uniform vec4 u_view;
uniform vec2 u_world;
uniform float u_phase;
out vec2 v_uv;
out float v_light;
void main() {
  float a = a_uv.x * 6.28318530718;
  float strip = a_uv.y * 2.0 - 1.0;
  float rx=u_world.x*.265, ry=u_world.y*.255;
  vec2 centerline=vec2(rx*cos(a),ry*sin(a*2.0));
  vec2 tangent=vec2(-rx*sin(a),2.0*ry*cos(a*2.0));
  vec2 normal=normalize(vec2(-tangent.y,tangent.x));
  // Lift the two crossings apart in depth; one half-twist joins opposite ribbon edges.
  float twist=a*.5-.7853981634+sin(u_phase*6.2831853)*.045;
  vec3 p=vec3(centerline+normal*strip*u_world.y*.135*cos(twist),-.34*sin(a)+strip*.18*sin(twist));
  float perspective=1.0/(1.0+p.z*.10);
  vec2 point=vec2(u_world.x*.5,u_world.y*.52)+p.xy*perspective;
  vec2 clip = (point-u_view.xy)/u_view.zw*2.0-1.0;
  gl_Position = vec4(clip.x, -clip.y, p.z*.6, 1.0);
  v_uv = a_uv;
  v_light = .85 + .15 * abs(cos(twist));
}`;

export const ringFragment = `#version 300 es
precision highp float;
uniform sampler2D u_text;
uniform float u_phase;
uniform vec3 u_accent;
uniform vec3 u_ink;
in vec2 v_uv;
in float v_light;
out vec4 color;
void main() {
  vec2 uv = vec2(fract(v_uv.x*2.0-u_phase*2.0), v_uv.y);
  vec3 sampleColor = texture(u_text, uv).rgb;
  vec3 base = sampleColor * v_light * mix(1.0, 1.8, smoothstep(.12, .5, sampleColor.g));
  float edge = smoothstep(.95, .993, abs(v_uv.y*2.0-1.0));
  float rail = (1.0-smoothstep(.003,.013,abs(abs(v_uv.y*2.0-1.0)-.94)))*.25;
  base += mix(u_ink,u_accent,.20) * (edge + rail);
  if (!gl_FrontFacing) base *= .86;
  color = vec4(base, 1.0);
}`;

export const lineVertex = `#version 300 es
precision highp float;
in vec2 a_position;
in vec4 a_color;
uniform vec4 u_view;
out vec4 v_color;
void main() {
  vec2 clip=(a_position-u_view.xy)/u_view.zw*2.0-1.0;
  gl_Position=vec4(clip.x,-clip.y,.9,1.0);
  v_color=a_color;
}`;

export const lineFragment = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 color;
void main() { color=v_color; }`;

export const packetVertex = `#version 300 es
precision highp float;
in vec4 a_packet;
in vec3 a_tail;
uniform vec4 u_view;
uniform vec2 u_world;
uniform float u_phase;
uniform float u_intensity;
uniform vec3 u_accent;
uniform vec3 u_ink;
out vec4 v_color;
float curve(float a, float b, float c, float d, float t) {
  float s=1.0-t;
  return s*s*s*a+3.0*s*s*t*b+3.0*s*t*t*c+t*t*t*d;
}
vec2 flow(float side,float lane,float t) {
  float angle=(lane-.5)*1.57079632679;
  float fromX=u_world.x*.5+side*u_world.x*.265*cos(angle);
  float y=u_world.y*(.52+.255*sin(angle*2.0));
  float toX=side<0.0 ? -80.0 : u_world.x+80.0;
  float targetY=u_world.y*(.52+(lane-.5)*1.08);
  return vec2(curve(fromX,fromX+side*u_world.x*.11,toX-side*u_world.x*.10,toX,t),
              curve(y,y,targetY,targetY,t));
}
void main() {
  float side=a_packet.x, lane=a_packet.y;
  float phase=fract(u_phase*a_packet.w+a_packet.z);
  float direction=a_tail.y>.5 ? -1.0 : 1.0;
  float progress=a_tail.y>.5 ? 1.0-phase : phase;
  float t=clamp(progress-.055*direction*(1.0-a_tail.x),0.0,1.0);
  vec2 point=flow(side,lane,t);
  vec2 tangent=normalize(flow(side,lane,t+.001)-flow(side,lane,t-.001));
  float width=1.5+a_packet.z*1.3;
  point+=vec2(-tangent.y,tangent.x)*a_tail.z*width*.5*(.45+.55*a_tail.x);
  vec2 clip=(point-u_view.xy)/u_view.zw*2.0-1.0;
  gl_Position=vec4(clip.x,-clip.y,.9,1.0);
  float alpha=(.16+a_tail.x*.70)*min(1.0,min(phase*15.0,(1.0-phase)*15.0));
  v_color=vec4(a_tail.y>.5 ? u_ink : u_accent,alpha*u_intensity);
}`;

export function program(gl, vertexSource, fragmentSource) {
  const shaders = [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]].map(([type, source]) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  });
  const result = gl.createProgram(); shaders.forEach(shader => gl.attachShader(result, shader)); gl.linkProgram(result);
  shaders.forEach(shader => gl.deleteShader(shader));
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result));
  return result;
}
