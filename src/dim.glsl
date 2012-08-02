#version 110
uniform sampler2D tex;
uniform float fraction;
const float c = -0.14;

mat3 lum = mat3 (0.3086, 0.6094, 0.0820,
                 0.3086, 0.6094, 0.0820,
                 0.3086, 0.6094, 0.0820);

void main()
{
    vec4 color = texture2D(tex, cogl_tex_coord_in[0].xy);
    
    vec3 ifraction3 = vec3(1.0 - fraction, 1.0 - fraction, 1.0 - fraction);
    vec3 fraction3 = vec3(fraction, fraction, fraction);
    
    // Apply grayscale effect
    cogl_color_out.rgb = color.rgb * lum * fraction3 + color.rgb * ifraction3;
    cogl_color_out.a = color.a;
    
    // Also decrease the contrast
    cogl_color_out.rgb = cogl_color_out.rgb + cogl_color_out.rgb * c * fraction;

}

