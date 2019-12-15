import { Vector2 } from "./Common.mjs";

export class Time {
    constructor() {
        this.date = new Date();
        this.deltaTime = 0;
        this.deltaTimeV2 = new Vector2(0, 0);
        this.lastTime = 0;

        this.Update = function() {
            this.date = new Date();
            this.deltaTime = (this.date.getTime() - this.lastTime) / 1000;
            this.deltaTimeV2 = new Vector2(this.deltaTime, this.deltaTime);
            this.lastTime = this.date.getTime();
            //Catch first delta time.
            if (this.deltaTime > 1)
                this.deltaTime = 1;
        };
    }
}
