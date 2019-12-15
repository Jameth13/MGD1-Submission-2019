//Enumerated types
//Keys
export const Keys = {
    W: 87,
    A: 65,
    S: 83,
    D: 68,
    M: 77,
    C: 67,
    Alpha1: 49,
    Alpha2: 50,
    Alpha3: 51,
    Alpha4: 52,
    Alpha5: 53,
    Alpha6: 54,
    Alpha7: 55,
    Alpha8: 56,
    Alpha9: 57,
    Num0: 96,
    Num1: 97,
    Num2: 98,
    L: 76,

    Space: 32,
    Escape: 27
};

//Physics type
export const Physics = {
    TRIGGER: 0,
    SIMULATED: 1,
    KINEMATIC: 2
};

//Scene
export const Scenes = {
    NONE: 0,
    MAINMENU: 1,
    GAME: 2,
    LOSS: 3,
    WIN: 4,
    EDITOR: 5
};

//Prop Type
export const PropType = {
    UNKNOWN: 0,
    WALL: 1,
    ROCK: 2,
    COIN: 3,
    LAVA: 4,
    ENEMY: 5,
    DOOR: 6,
    KEY: 7,
    CHEST: 8
};

export const defaultGrid = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

//Vector2
export class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        this.Set = function(v) {
            this.x = v.x;
            this.y = v.y;
        };
        this.Add = function(v) {
            this.x += v.x;
            this.y += v.y;
        };
        this.Sub = function(v) {
            this.x -= v.x;
            this.y -= v.y;
        };
        this.Mult = function(v) {
            this.x *= v.x;
            this.y *= v.y;
        };
        this.Div = function(v) {
            this.x /= v.x;
            this.y /= v.y;
        };

        this.Equ = function(v) {
            return this.x === v.x && this.y === v.y;
        };

        this.Mag = function() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        };
        this.Normalize = function() {
            const mag = this.Mag();
            if (mag === 0)
                return;
            this.x /= mag;
            this.y /= mag;
        };

        this.toString = function() {
            return `(${this.x}, ${this.y})`;
        };
    }
    static Add(v1, v2) {
        return new Vector2(v1.x + v2.x, v1.y + v2.y);
    }
    static Sub(v1, v2) {
        return new Vector2(v1.x - v2.x, v1.y - v2.y);
    }
    static Mult(v1, v2) {
        return new Vector2(v1.x * v2.x, v1.y * v2.y);
    }
    static Div(v1, v2) {
        return new Vector2(v1.x / v2.x, v1.y / v2.y);
    }
    static Equ(v1, v2) {
        return v1.x === v2.x && v1.y === v2.y;
    }
    static Dist(v1, v2) {
        return Math.sqrt((v2.x - v1.x) * (v2.x - v1.x) + (v2.y - v1.y) * (v2.y - v1.y));
    }
    static SqrDist(v1, v2) {
        return (v2.x - v1.x) * (v2.x - v1.x) + (v2.y - v1.y) * (v2.y - v1.y);
    }
    static GridDist(v1, v2) {
        return Math.abs(v2.x - v1.x) + Math.abs(v2.y - v1.y);
    }
}


//Remove element from Array
export function RemoveFromArray(array, item) {
    const filtered = array.filter(function(value, index, arr) {
        //How to compare objects - Ref: https://stackoverflow.com/questions/1068834/object-comparison-in-javascript
        return JSON.stringify(value, CircularReplacer()) !== JSON.stringify(item, CircularReplacer());
    });
    return filtered;
}


//Remove circular reference in JSON.stringify - Ref: https://stackoverflow.com/questions/11616630/how-can-i-print-a-circular-structure-in-a-json-like-format
export function CircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value))
                return;
            seen.add(value);
        }
        return value;
    };
};
