const WIDTH  = 512;
const HEIGHT = 256;
const QUAD = new Float32Array([-1, -1, +1, -1, -1, +1, +1, +1]);
const PALETTE = new Uint8Array([
    0x07, 0x07, 0x07, 0x1F, 0x07, 0x07, 0x2F, 0x0F, 0x07, 0x47, 0x0F, 0x07,
    0x57, 0x17, 0x07, 0x67, 0x1F, 0x07, 0x77, 0x1F, 0x07, 0x8F, 0x27, 0x07,
    0x9F, 0x2F, 0x07, 0xAF, 0x3F, 0x07, 0xBF, 0x47, 0x07, 0xC7, 0x47, 0x07,
    0xDF, 0x4F, 0x07, 0xDF, 0x57, 0x07, 0xDF, 0x57, 0x07, 0xD7, 0x5F, 0x07,
    0xD7, 0x5F, 0x07, 0xD7, 0x67, 0x0F, 0xCF, 0x6F, 0x0F, 0xCF, 0x77, 0x0F,
    0xCF, 0x7F, 0x0F, 0xCF, 0x87, 0x17, 0xC7, 0x87, 0x17, 0xC7, 0x8F, 0x17,
    0xC7, 0x97, 0x1F, 0xBF, 0x9F, 0x1F, 0xBF, 0x9F, 0x1F, 0xBF, 0xA7, 0x27,
    0xBF, 0xA7, 0x27, 0xBF, 0xAF, 0x2F, 0xB7, 0xAF, 0x2F, 0xB7, 0xB7, 0x2F,
    0xB7, 0xB7, 0x37, 0xCF, 0xCF, 0x6F, 0xDF, 0xDF, 0x9F, 0xEF, 0xEF, 0xC7,
    0xFF, 0xFF, 0xFF
]);
const DEPTH = PALETTE.length / 3;

/* The state is an RGB image only using the red channel. Values range
 * from 0 to 1 and are mapped back onto the 37-element palette.
 */
const STATE_RENDER = {
    vert: `precision mediump float;
attribute vec2 a_point;
varying   vec2 v_point;
void main() {
    v_point = (a_point + 1.0) / 2.0;
    gl_Position = vec4(a_point, 0, 1);
}`,
    frag: `precision mediump float;
uniform sampler2D u_state;
uniform sampler2D u_palette;
varying vec2 v_point;
void main() {
    float v = texture2D(u_state, v_point).r;
    vec4 color = texture2D(u_palette, vec2(v, 0));
    gl_FragColor = vec4(color);
}`,
};

/* Writes the next state into the framebuffer from the current state,
 * which is bound to active texture 0.
 *
 * u_temperature and u_flame_height are tweakable parameters.
 *
 * u_random feeds new entropy into the system.
 */
const STATE_UPDATE = {
    vert: `precision mediump float;
attribute vec2 a_point;
varying   vec2 v_point;
void main() {
    v_point = (a_point + 1.0) / 2.0;
    gl_Position = vec4(a_point, 0, 1);
}`,
    frag: `precision mediump float;
uniform sampler2D u_state;
uniform float u_temperature;
uniform float u_flame_height;
uniform vec4 u_random;
varying vec2 v_point;

float get(vec2 p) {
    float depth = float(${DEPTH - 1});
    vec2 scale = vec2(${WIDTH - 1}, ${HEIGHT - 1});
    return floor(texture2D(u_state, p / scale).r * depth + 0.5);
}

float rand(vec2 s) {
    s += v_point;
    float a = sin(dot(v_point + s, vec2(12.9898, 78.233)));
    return fract(fract(a * 41.0744) * 86.9083);
}

void main() {
    vec2 scale = vec2(${WIDTH - 1}, ${HEIGHT - 1});
    vec2 pos = floor(v_point * scale + 0.5);
    if (pos.y == 0.0) {
        gl_FragColor = vec4(u_temperature, 0, 0, 0);
    } else {
        float dx = floor(rand(u_random.xy) * 3.0) - 1.0;
        float dy = floor(rand(u_random.zw) * 3.0) - 2.0;
        float r  = floor(rand(u_random.wx) + 1.0 - u_flame_height);
        float v = get(pos + vec2(dx, dy)) - r;
        float depth = float(${DEPTH - 1});
        gl_FragColor = vec4(v / depth, 0, 0, 0);
    }
}`,
};

function compile(gl, vert, frag) {
    let v = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(v, vert);
    let f = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(f, frag);
    gl.compileShader(v);
    if (!gl.getShaderParameter(v, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(v));
    gl.compileShader(f);
    if (!gl.getShaderParameter(f, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(f));
    let p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p));
    gl.deleteShader(v);
    gl.deleteShader(f);
    let result = {
        program: p
    };
    let nattrib = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let a = 0; a < nattrib; a++) {
        let name = gl.getActiveAttrib(p, a).name;
        result[name] = gl.getAttribLocation(p, name);
    }
    let nuniform = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let u = 0; u < nuniform; u++) {
        let name = gl.getActiveUniform(p, u).name;
        result[name] = gl.getUniformLocation(p, name);
    }
    return result;
};

function Fire(gl) {
    let quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

    let state0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, state0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0, gl.RGBA,
        WIDTH, HEIGHT,
        0, gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
    );

    let state1 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, state1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0, gl.RGBA,
        WIDTH, HEIGHT,
        0, gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
    );

    let palette = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, palette);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0, gl.RGB,
        DEPTH, 1,
        0, gl.RGB,
        gl.UNSIGNED_BYTE,
        PALETTE
    );

    let fb = gl.createFramebuffer();
    let update = compile(gl, STATE_UPDATE.vert, STATE_UPDATE.frag);
    let render = compile(gl, STATE_RENDER.vert, STATE_RENDER.frag);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    let self = {
        temperature:  1.0,  // 0.0 - 1.0
        flame_height: 0.75, // 0.0 - 1.0

        update: function() {
            gl.useProgram(update.program);

            gl.uniform1f(update.u_temperature, self.temperature);
            gl.uniform1f(update.u_flame_height, self.flame_height);
            gl.uniform4f(
                update.u_random,
                Math.random(),
                Math.random(),
                Math.random(),
                Math.random()
            );

            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                state1,
                0
            );
            gl.viewport(0, 0, WIDTH, HEIGHT);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state0);
            gl.uniform1i(update.u_state, 0);

            gl.enableVertexAttribArray(render.a_point);
            gl.bindBuffer(gl.ARRAY_BUFFER, quad);
            gl.vertexAttribPointer(render.a_point, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, QUAD.length / 2);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.useProgram(null);

            [state0, state1] = [state1, state0]; // swap old and new
        },

        render: function() {
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

            gl.useProgram(render.program);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state0);
            gl.uniform1i(render.u_state, 0);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, palette);
            gl.uniform1i(render.u_palette, 1);

            gl.enableVertexAttribArray(render.a_point);
            gl.bindBuffer(gl.ARRAY_BUFFER, quad);
            gl.vertexAttribPointer(render.a_point, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, QUAD.length / 2);

            /* Cleanup */

            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.useProgram(null);
        },

        clear: function() {
            gl.bindTexture(gl.TEXTURE_2D, state0);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0, 0, 0,
                WIDTH, HEIGHT,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                new Uint8Array(WIDTH * HEIGHT * 4)
            );
            gl.bindTexture(gl.TEXTURE_2D, null);
        },

        destroy: function() {
            gl.deleteProgram(update.program);
            gl.deleteProgram(render.program);
            gl.deleteBuffer(quad);
            gl.deleteTexture(state0);
            gl.deleteTexture(state1);
            gl.deleteTexture(palette);
            gl.deleteFramebuffer(fb);
        }
    };
    return self;
}

(function() {
    let canvas = document.querySelector('canvas');
    let gl = canvas.getContext('webgl');
    let fire = new Fire(gl);
    let running = true;
    let period = 1000 / 70;  // 70 FPS (max)
    let last = 0;

    window.addEventListener('keyup', function(e) {
        switch (e.which) {
            case 32: /* Space */
                running = !running;
                break;
            case 33: /* PgUp */
                fire.temperature = Math.min(fire.temperature + 0.1, 1);
                break;
            case 34: /* PgDown */
                fire.temperature = Math.max(fire.temperature - 0.1, 0);
                break;
            case 38: /* Up */
                fire.flame_height = Math.min(1.0, fire.flame_height += 0.05);
                console.log(fire.flame_height);
                break;
            case 40: /* Down */
                fire.flame_height = Math.max(0.0, fire.flame_height -= 0.05);
                console.log(fire.flame_height);
                break;
            case 65: /* e */
                for (let i = 0; i < 1024; i++)
                    fire.update();
                break;
            case 67: /* c */
                fire.clear();
                break;
            case 82: /* r */
                fire.destroy();
                fire = new Fire(gl);
                break;
            case 107: /* Plus */
                period *= 1 / 1.2;
                console.log(1000 / period + ' fps');
                break;
            case 109: /* Plus */
                period *= 1.2;
                console.log(1000 / period + ' fps');
                break;
            case 190: /* Period */
                if (running)
                    running = false;
                else
                    fire.update();
                break;
        }
    });

    function cb(t) {
        let dirty = false;
        let ww = window.innerWidth;
        let wh = window.innerHeight;
        if (canvas.width != ww || canvas.height != wh) {
            canvas.width = ww;
            canvas.height = wh;
            dirty = true;
        }
        if (running) {
            let now = Date.now();
            if (now - last > period) {
                fire.update();
                dirty = true;
                last = now;
            }
        }
        if (dirty) {
            fire.render();
        }
        window.requestAnimationFrame(cb);
    }
    window.requestAnimationFrame(cb);
}());
