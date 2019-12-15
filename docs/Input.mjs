import { Vector2 } from "./Common.mjs";

//Input
export class Input {
    //TODO: Add lost focus clear all.
    constructor() {
        this.keys = [];
        this.keysDown = [];
        this.mouseClicks = [];
        this.mouseClicksDown = [];
        this.mousePos = new Vector2(0, 0);
        this.mouseWheel = 0;

        this.AddKey = function(key) {
            if (!this.keys[key])
                this.keysDown[key] = true;
            this.keys[key] = true;
        };
        this.RemoveKey = function(key) {
            this.keys[key] = false;
        };
        this.AddClick = function(click) {
            if (!this.mouseClicks[click])
                this.mouseClicksDown[click] = true;
            this.mouseClicks[click] = true;
        };
        this.RemoveClick = function(click) {
            this.mouseClicks[click] = false;
        };
        this.MouseMove = function(pos) {
            this.mousePos = pos;
        };
        this.MouseWheel = function(movement) {
            if (movement > 0)
                this.mouseWheel = -1;
            if (movement < 0)
                this.mouseWheel = 1;
        };

        this.GetKey = function(key) {
            return this.keys[key];
        };
        this.GetKeyDown = function(key) {
            return this.keysDown[key];
        };
        this.GetClick = function(key) {
            return this.mouseClicks[key];
        };
        this.GetClickDown = function(key) {
            return this.mouseClicksDown[key];
        };

        this.Reset = function() {
            //HELP - How to set element to 'empty'?
            //Set all values to undefined.
            this.keysDown = this.keysDown.map(function(key) { });
            this.mouseClicksDown = this.mouseClicksDown.map(function(click) { });
            this.mouseWheel = 0;
        };
    }
}
