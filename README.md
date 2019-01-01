# WebGL Fire

This is a little WebGL demo of the fire effect described in [How DOOM
fire was done][doom]. The entire effect is computed on the GPU [using
shaders][gol].

[doom]: http://fabiensanglard.net/doom_fire_psx/
[gol]: https://nullprogram.com/blog/2014/06/10/

## Controls

* SPACE: Toggle pause
* PgUp/PgDown: Adjust the burner temperature
* +/-: Adjust animation speed
* Period: Advance state one step forward while paused
* a: Instantly advance simulation 1024 steps
* c: Clear the fire state to zero
* r: Reset the entire simulation (reinitialize WebGL state)
