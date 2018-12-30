# WebGL Fire

This is a little WebGL demo of the fire effect described in [How DOOM
fire was done][doom]. The entire effect is computed on the GPU [using
shaders][gol].

[doom]: http://fabiensanglard.net/doom_fire_psx/
[gol]: https://nullprogram.com/blog/2014/06/10/

## Controls

* SPACE: Toggle pause
* PgUp: Increase the burner temperature
* PgDown: Decrease the burner temperature
* Period: Advance state one step forward while paused
* R: Reset the entire simulation (reinitialize WebGL state)
