import { hash } from '../scene/geometry.js';

export const INNER_PACKETS = 208;
export const OUTER_PACKETS = 512;

function addQuad(vertices, path, start, end, kind) {
  for (const [t, edge] of [[start, -1], [end, -1], [start, 1], [start, 1], [end, -1], [end, 1]]) {
    vertices.push(...path, t, edge, kind);
  }
}

export function innerMeshes() {
  const routes = [], packets = [];
  const path = index => [index % 2 ? 1 : -1, Math.floor(index / 2) % 88, hash(`inner:${index}`), 8 + index % 6];
  for (let i = 0; i < 176; i++) for (let segment = 0; segment < 32; segment++) {
    addQuad(routes, path(i), segment / 32, (segment + 1) / 32, 0);
  }
  for (let i = 0; i < INNER_PACKETS; i++) {
    for (let segment = 0; segment < 3; segment++) addQuad(packets, path(i), segment / 3, (segment + 1) / 3, 0);
    // A compact rectangular head gives each moving trail a visible data-packet silhouette.
    addQuad(packets, path(i), 0, 1, 1);
  }
  return { routes: new Float32Array(routes), packets: new Float32Array(packets) };
}

export const innerVertex = `#version 300 es
precision highp float;
in vec4 a_path;
in vec3 a_sample;
uniform vec4 u_view;
uniform vec2 u_world;
uniform float u_phase;
uniform float u_packets;
uniform vec3 u_accent;
uniform vec3 u_ink;
out vec4 v_color;
vec2 curve(vec2 a,vec2 b,vec2 c,vec2 d,float t) {
  float s=1.0-t;
  return s*s*s*a+3.0*s*s*t*b+3.0*s*t*t*c+t*t*t*d;
}
vec2 point(float t) {
  float lane=a_path.y, side=a_path.x;
  float a=lane/88.0*6.28318530718, b=a+1.2+mod(lane,7.0)*.33;
  vec2 center=vec2(u_world.x*(.5+side*.145),u_world.y*.52);
  vec2 radius=u_world*vec2(.102,.172);
  vec2 start=center+vec2(cos(a),sin(a))*radius;
  vec2 end=center+vec2(cos(b),sin(b))*radius;
  float wave=sin(u_phase*18.8495559215+lane*.37)*u_world.y*.014;
  float bend=(a_path.z-.5)*u_world.y*.35;
  vec2 first=vec2(center.x-side*radius.x*.75,start.y+bend+wave);
  vec2 last=vec2(center.x+side*radius.x*.65,end.y-bend-wave);
  return curve(start,first,last,end,t);
}
void main() {
  float phase=fract(u_phase*a_path.w+a_path.z);
  float direction=a_path.x<0.0 ? 1.0 : -1.0;
  float progress=direction>0.0 ? phase : 1.0-phase;
  float head=a_sample.z;
  float t=a_sample.x;
  float width=mod(a_path.y,6.0)<1.0 ? 1.6 : 1.0;
  float opacity=mod(a_path.y,6.0)<1.0 ? .29 : .15;
  vec3 ink=u_ink;
  if (u_packets>.5) {
    t=head>.5 ? progress+(a_sample.x-.5)*.013*direction : progress-.13*direction*(1.0-a_sample.x);
    t=clamp(t,0.0,1.0);
    width=head>.5 ? 3.6 : 1.7+a_sample.x*.8;
    opacity=(head>.5 ? .98 : .12+.78*a_sample.x)*min(1.0,min(phase*14.0,(1.0-phase)*14.0));
    ink=mix(u_accent,u_ink,head>.5 ? .7 : .2);
  }
  vec2 p=point(t);
  vec2 tangent=normalize(point(t+.001)-point(t-.001));
  p+=vec2(-tangent.y,tangent.x)*a_sample.y*width*.5;
  vec2 clip=(p-u_view.xy)/u_view.zw*2.0-1.0;
  gl_Position=vec4(clip.x,-clip.y,.9,1.0);
  v_color=vec4(ink,opacity);
}`;
