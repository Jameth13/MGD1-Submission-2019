//Imports
import { Keys, Physics, Scenes, PropType, defaultGrid, Vector2, RemoveFromArray, CircularReplacer } from "./Common.mjs";
import { SaveCookie, DeleteCookie, LoadCookie } from "./Cookies.mjs";
import { Input } from "./Input.mjs";
import { Time } from "./Time.mjs";

//Canvas and context
const canvas = document.getElementById("canvasMain");
const canvasUI = document.getElementById("canvasUI");
const context = canvas.getContext("2d");
const contextUI = canvasUI.getContext("2d");

//UI Position
canvasUI.style.position = "relative";
canvasUI.style.top = "4px";

//Allow Pixel Art
context.mozImageSmoothingEnabled = false;
context.webkitImageSmoothingEnabled = false;
context.msImageSmoothingEnabled = false;
context.imageSmoothingEnabled = false;
contextUI.mozImageSmoothingEnabled = false;
contextUI.webkitImageSmoothingEnabled = false;
contextUI.msImageSmoothingEnabled = false;
contextUI.imageSmoothingEnabled = false;

//Constants & global variables
const WORLD_SCALE = new Vector2(4, 4);
const CANVAS_SIZE = new Vector2(canvas.width, canvas.height);
const CANVAS_SIZE_UI = new Vector2(canvasUI.width, canvasUI.height);
const IMAGE_SIZE = new Vector2(16, 16);
let editing = false;
let drawColliders = false;

//Input
const input = new Input();

//Listen - Ref: https://www.geeksforgeeks.org/javascript-addeventlistener-with-examples/
document.addEventListener("keydown", KeyDown);
document.addEventListener("keyup", KeyUp);
document.addEventListener("wheel", MouseWheel);
canvas.addEventListener("mousedown", MouseDown);
canvas.addEventListener("mouseup", MouseUp);
canvas.addEventListener("mousemove", MouseMove);

//Hide context menu
document.addEventListener("contextmenu", event => event.preventDefault());

function KeyDown(event) {
    input.AddKey(event.keyCode);
}
function KeyUp(event) {
    input.RemoveKey(event.keyCode);
}
function MouseDown(event) {
    input.AddClick(event.button);
}
function MouseUp(event) {
    input.RemoveClick(event.button);
}
function MouseMove(event) {
    input.MouseMove(new Vector2(event.layerX, event.layerY));
}
function MouseWheel(event) {
    input.MouseWheel(event.deltaY);
}


//Time
const time = new Time();


//Sprite
class Sprite {
    //Default values: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters
    constructor(src, speed = 0, imageSizeOverride = IMAGE_SIZE) {
        //Allow passing of single src - Ref: https://stackoverflow.com/questions/1961528/how-to-check-if-an-array-exist-if-not-create-it-in-javascript
        if (!Array.isArray(src))
            src = [src];

        this.img = [];
        for (let i = 0; i < src.length; i++) {
            this.img[i] = new Image(imageSizeOverride.x, imageSizeOverride.y);
            this.img[i].src = src[i];
        }

        this.speed = speed;
        this.frame = 0;
        this.animTimer = 0;

        this.Draw = function(pos = new Vector2(0, 0), scale = new Vector2(1, 1)) {
            this.Anim();
            context.drawImage(this.img[this.frame], pos.x, -pos.y + CANVAS_SIZE.y - this.img[this.frame].height * scale.y, this.img[this.frame].width * scale.x, this.img[this.frame].height * scale.y);
        };

        this.DrawUI = function(pos = new Vector2(0, 0), scale = new Vector2(1, 1)) {
            this.Anim();
            contextUI.drawImage(this.img[this.frame], pos.x, -pos.y + CANVAS_SIZE_UI.y - this.img[this.frame].height * scale.y, this.img[this.frame].width * scale.x, this.img[this.frame].height * scale.y);
        };

        this.Anim = function() {
            if (this.speed > 0) {
                this.animTimer += time.deltaTime;
                if (this.animTimer >= this.speed) {
                    this.animTimer -= this.speed;
                    this.frame++;
                    if (this.frame + 1 > this.img.length)
                        this.frame = 0;
                }
            }
        };
    }
}


//Collision detection & Physics
//Rectangle collider
class RectCollider {
    constructor(pos = new Vector2(0, 0), size = new Vector2(10, 10), physics = Physics.SIMULATED, tag = "Untagged") {
        this.pos = pos;
        this.size = size;
        this.colliding = false;
        this.collidingWith = [];
        this.physics = physics;
        this.tag = tag;
        this.enabled = true;
        colMan.Add(this);

        this.Update = function(pos) {
            this.pos = pos;
        };
        this.Remove = function() {
            colMan.Remove(this);
        };
    }
}


function RectCollision(rect1, rect2) {
    return (
        rect1.enabled && rect2.enabled &&
        rect1.pos.x < rect2.pos.x + rect2.size.x &&
        rect1.pos.x + rect1.size.x > rect2.pos.x &&
        rect1.pos.y < rect2.pos.y + rect2.size.y &&
        rect1.pos.y + rect1.size.y > rect2.pos.y
    );
};

//Physics
function RectResolve(rect1, rect2) {
    //Return if either collider is a trigger.
    if (rect1.physics === Physics.TRIGGER || rect2.physics === Physics.TRIGGER)
        return;

    //Return if both colliders are kinematic.
    if (rect1.physics === Physics.KINEMATIC && rect2.physics === Physics.KINEMATIC)
        return;

    //If either collider is simulated, resolve collision.
    if (rect1.physics === Physics.SIMULATED || rect2.physics === Physics.SIMULATED) {
        let dist = Math.max(1 / Vector2.Dist(rect1.pos, rect2.pos), 0.015);
        dist *= 12000 * time.deltaTime;
        const dir = Vector2.Sub(rect1.pos, rect2.pos);
        dir.Normalize();
        if (rect1.physics === Physics.SIMULATED)
            rect1.pos.Add(Vector2.Mult(dir, new Vector2(dist, dist)));
        if (rect2.physics === Physics.SIMULATED)
            rect2.pos.Sub(Vector2.Mult(dir, new Vector2(dist, dist)));
    }
}


//Collision Manager
class ColMan {
    constructor() {
        this.colliders = [];

        this.Add = function(collider) {
            this.colliders.push(collider);
        };
        this.Remove = function(collider) {
            this.colliders = RemoveFromArray(this.colliders, collider);
        };
        this.Clear = function() {
            this.colliders = [];
        };

        this.CalcCollisions = function() {
            //Clear collisions
            for (let i = 0; i < this.colliders.length; i++) {
                this.colliders[i].colliding = false;
                this.colliders[i].collidingWith = [];
            }

            //Loop through each possible pair once.
            for (let i1 = 0; i1 < this.colliders.length; i1++)
                for (let i2 = i1 + 1; i2 < this.colliders.length; i2++)
                    if (RectCollision(this.colliders[i1], this.colliders[i2])) {
                        this.colliders[i1].colliding = true;
                        this.colliders[i1].collidingWith.push(this.colliders[i2]);
                        this.colliders[i2].colliding = true;
                        this.colliders[i2].collidingWith.push(this.colliders[i1]);
                        RectResolve(this.colliders[i1], this.colliders[i2]);
                    }
        };
        this.Draw = function() {
            this.colliders.forEach(function(c) {
                if (c.colliding)
                    context.strokeStyle = "#FF0000";
                else if (c.enabled)
                    context.strokeStyle = "#00FF00";
                else
                    context.strokeStyle = "#FFFF00";
                context.strokeRect(c.pos.x, CANVAS_SIZE.y - c.pos.y, c.size.x, -c.size.y);
            });
        };
    }
}

const colMan = new ColMan();


//Sprites
const charSprites = new Sprite(["sprites/characterUp.png", "sprites/characterRight.png", "sprites/characterDown.png", "sprites/characterLeft.png"]);
const grassGreenMoving = new Sprite(["sprites/grassGreen01.png", "sprites/grassGreen02.png", "sprites/grassGreen03.png", "sprites/grassGreen04.png"], 0.3);
const grassYellowMoving = new Sprite(["sprites/grassYellowMoving01.jpg", "sprites/grassYellowMoving02.jpg", "sprites/grassYellowMoving03.jpg", "sprites/grassYellowMoving04.jpg"], 0.3);
const grassYellow01 = new Sprite("sprites/grassYellow01.jpg");
const grassYellow02 = new Sprite("sprites/grassYellow02.jpg");
const sand = new Sprite(["sprites/sand01.png", "sprites/sand02.png"], 0.8);
const lava = new Sprite(["sprites/lava01.png", "sprites/lava02.png", "sprites/lava03.png"], 0.4);
const rock = new Sprite("sprites/rock.png");
const rockHeavy = new Sprite("sprites/rockHeavy.png");
const coin = new Sprite("sprites/coin.png");
const swordStatic = new Sprite("sprites/swordUp.png");
const sword = new Sprite(["sprites/swordUp.png", "sprites/swordUpRight.png", "sprites/swordRight.png", "sprites/swordDownRight.png", "sprites/swordDown.png", "sprites/swordDownLeft.png", "sprites/swordLeft.png", "sprites/swordUpLeft.png"]);
const mainmenu = new Sprite("sprites/mainmenu.png");
const enemy = new Sprite("sprites/enemy.png");
const heart = new Sprite("sprites/heart.png");
const border1 = new Sprite("sprites/border1.png", 0, new Vector2(18, 18));
const border3 = new Sprite("sprites/border3.png", 0, new Vector2(56, 18));
const keys = new Sprite(["sprites/keyRed.png", "sprites/keyGreen.png", "sprites/keyBlue.png"]);
const doors = new Sprite(["sprites/doorRed.png", "sprites/doorGreen.png", "sprites/doorBlue.png"]);
const chest = new Sprite("sprites/chest.png", 0, new Vector2(32, 16));
const wall = new Sprite("sprites/wall.jpg");

//Sounds
const coinSound = new Audio("sounds/coin.wav");
const swordNothing = new Audio("sounds/sword_nothing.wav");
const characterHurt = new Audio("sounds/character_hurt.wav");
const enemyDeath = new Audio("sounds/enemy_death.wav");


//Background Music
//Working with promises - Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises
//Function delay - Ref: https://www.tutorialspoint.com/How-to-delay-a-JavaScript-function-call-using-JavaScript
const background = new Audio("sounds/background.mp3");
background.loop = true;

let promise = background.play();
promise.then(PromiseSuccess, PromiseFailure);

function PromiseSuccess() {
    console.log("Background audio playing.");
}

function PromiseFailure() {
    console.error("Background audio failed to play. Trying again in 3 seconds...");
    setTimeout(function() {
        promise = background.play();
        promise.then(PromiseSuccess, PromiseFailure);
    }, 3000);
}


//_____Character_____
class Character {
    constructor() {
        this.pos = new Vector2(100, 100);
        this.speed = new Vector2(180, 180);
        this.scale = WORLD_SCALE;
        this.sprite = charSprites;
        this.lastDir = new Vector2(0, -1);
        this.collider = new RectCollider(Vector2.Add(this.pos, new Vector2(4, 4)), new Vector2(56, 56), Physics.SIMULATED, "Player");
        //Collectables
        this.keys = [false, false, false];
        this.score = 0;
        //Health
        this.health = 3;
        this.immune = false;
        this.immuneTime = 0.8;
        this.immuneTimer = 0;
        //Attacking
        this.attacking = false;
        this.attackTime = 0.2;
        this.attackTimer = 0;
        this.attackCooldownTime = 0.5;
        this.attackCooldownTimer = 0;
        this.swordCollider = new RectCollider(this.pos, Vector2.Mult(new Vector2(this.sprite.img[0].width, this.sprite.img[0].height), this.scale), this.physics);

        this.Move = function(v) {
            this.pos = new Vector2(this.collider.pos.x - 4, this.collider.pos.y - 4);
            v.Normalize();
            if (!Vector2.Equ(v, new Vector2(0, 0)) && !this.attacking)
                this.lastDir = v;
            const speedDelta = Vector2.Mult(this.speed, time.deltaTimeV2);
            this.pos.Add(Vector2.Mult(v, speedDelta));
            this.collider.Update(new Vector2(this.pos.x + 4, this.pos.y + 4));

            //Update sprite
            if (this.lastDir.x === 0 && this.lastDir.y === 1)
                this.sprite.frame = 0;
            if (this.lastDir.x === 0.7071067811865475 && this.lastDir.y === 0.7071067811865475)
                this.sprite.frame = 0;
            if (this.lastDir.x === 1 && this.lastDir.y === 0)
                this.sprite.frame = 1;
            if (this.lastDir.x === 0.7071067811865475 && this.lastDir.y === -0.7071067811865475)
                this.sprite.frame = 2;
            if (this.lastDir.x === 0 && this.lastDir.y === -1)
                this.sprite.frame = 2;
            if (this.lastDir.x === -0.7071067811865475 && this.lastDir.y === -0.7071067811865475)
                this.sprite.frame = 2;
            if (this.lastDir.x === -1 && this.lastDir.y === 0)
                this.sprite.frame = 3;
            if (this.lastDir.x === -0.7071067811865475 && this.lastDir.y === 0.7071067811865475)
                this.sprite.frame = 0;
        };

        this.SetPos = function(pos) {
            this.pos = pos;
            this.collider.Update(new Vector2(this.pos.x + 4, this.pos.y + 4));
        };
        this.SetPosX = function(posX) {
            this.pos.x = posX;
            this.collider.Update(new Vector2(this.pos.x + 4, this.pos.y + 4));
        };
        this.SetPosY = function(posY) {
            this.pos.y = posY;
            this.collider.Update(new Vector2(this.pos.x + 4, this.pos.y + 4));
        };

        this.Push = function(v) {
            this.pos.Add(v);
            this.collider.Update(new Vector2(this.pos.x + 4, this.pos.y + 4));
        };

        this.Update = function() {
            //Attack
            if (input.GetKeyDown(Keys.Space))
                this.Attack();

            //Attack timer
            this.attackTimer += time.deltaTime;
            this.attackCooldownTimer -= time.deltaTime;
            if (this.attackTimer >= this.attackTime)
                this.attacking = false;

            //Immuniyty
            if (this.immune)
                this.immuneTimer -= time.deltaTime;
            if (this.immuneTimer <= 0)
                this.immune = false;
        };
        this.Attack = function() {
            if (!this.attacking && this.attackCooldownTimer <= 0) {
                this.attacking = true;
                this.attackTimer = 0;
                this.attackCooldownTimer = this.attackCooldownTime;
                swordNothing.play();

                //Select sword sprite
                //Many methods of rotating the image were attempted but this was the simplest (albeit the most naive).
                sword.frame = 0; //Default sprite
                if (this.lastDir.x === 0.7071067811865475 && this.lastDir.y === 0.7071067811865475)
                    sword.frame = 1;
                if (this.lastDir.x === 1 && this.lastDir.y === 0)
                    sword.frame = 2;
                if (this.lastDir.x === 0.7071067811865475 && this.lastDir.y === -0.7071067811865475)
                    sword.frame = 3;
                if (this.lastDir.x === 0 && this.lastDir.y === -1)
                    sword.frame = 4;
                if (this.lastDir.x === -0.7071067811865475 && this.lastDir.y === -0.7071067811865475)
                    sword.frame = 5;
                if (this.lastDir.x === -1 && this.lastDir.y === 0)
                    sword.frame = 6;
                if (this.lastDir.x === -0.7071067811865475 && this.lastDir.y === 0.7071067811865475)
                    sword.frame = 7;
            }
        };
        this.Hurt = function(amount) {
            if (this.health <= 0)
                return;

            if (!this.immune) {
                this.immune = true;
                this.immuneTimer = this.immuneTime;
                this.health -= amount;
                characterHurt.play();
            }

            if (this.health <= 0)
                LossCondition();
        };

        this.Draw = function() {
            //Immunity
            if (!(this.immune && this.immuneTimer % 0.2 > 0.12))
                this.sprite.Draw(this.pos, this.scale);
            //Attacking
            if (this.attacking) {
                const pos = Vector2.Add(this.pos, Vector2.Mult(new Vector2(16 * 4, 16 * 4), this.lastDir));
                sword.Draw(pos, this.scale);
                this.swordCollider.pos = pos;
                this.swordCollider.enabled = true;
            } else
                this.swordCollider.enabled = false;
        };

        this.Reset = function() {
            console.log("Resetting character data...");
            this.Revive();
            this.score = 0;
            DeleteCookie("activeScreen");
            DeleteCookie("character");
        };
        this.Revive = function() {
            this.pos = new Vector2(100, 100);
            this.collider.pos = new Vector2(100, 100);
            LoadCharacter();
            this.health = 3;
            this.immune = false;
        };
        this.InitColliders = function() {
            this.collider = new RectCollider(Vector2.Add(this.pos, new Vector2(6, 6)), new Vector2(52, 52), Physics.SIMULATED, "Player");
            this.swordCollider = new RectCollider(this.pos, Vector2.Mult(new Vector2(this.sprite.img[0].width, this.sprite.img[0].height), this.scale), Physics.TRIGGER, "Sword");
        };
    }
}

const character = new Character();
let charDir = new Vector2(0, 0);

//Save / Load character
function SaveCharacter() {
    console.log("Saving character data...");
    SaveCookie("activeScreen", map.activeScreen.id);
    SaveCookie("character", JSON.stringify(character, CircularReplacer()));
};

function LoadCharacter() {
    console.log("Loading character data...");
    const activeScreen = LoadCookie("activeScreen");
    if (activeScreen != null)
        map.SetScreen(screens[activeScreen]);
    else
        map.SetScreen(screens[0]);

    const characterData = JSON.parse(LoadCookie("character"));
    if (characterData != null) {
        Object.assign(character.pos, characterData.pos);
        character.score = characterData.score;
        character.keys = characterData.keys;
    } else {
        character.score = 0;
        character.keys = [false, false, false];
    }
};


//_____Props_____
//Prop Manager
class PropMan {
    constructor() {
        this.props = [];

        this.Add = function(prop) {
            this.props.push(prop);
        };
        this.Remove = function(prop) {
            this.props = RemoveFromArray(this.props, prop);
            colMan.Remove(prop.collider);
        };
        this.Clear = function() {
            this.props = [];
            colMan.Clear();
            character.InitColliders();
        };

        this.Update = function() {
            for (let i = 0; i < this.props.length; i++)
                if (this.props[i].Update)
                    this.props[i].Update();
        };

        this.Draw = function() {
            for (let i = 0; i < this.props.length; i++)
                this.props[i].sprite.Draw(this.props[i].pos, this.props[i].scale);
        };

        this.Process = function(props) {
            this.Clear();

            for (let x = 0; x < props[0].length; x++)
                for (let y = 0; y < props.length; y++) {
                    if (props[y][x] === 1)
                        new Wall(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), Physics.KINEMATIC);
                    if (props[y][x] === 2)
                        new Rock(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), Physics.SIMULATED);
                    if (props[y][x] === 3)
                        new Rock(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), Physics.KINEMATIC);
                    if (props[y][x] === 4)
                        new Coin(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y));
                    if (props[y][x] === 5)
                        new Lava(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y));
                    if (props[y][x] === 6)
                        new Enemy(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), 0);
                    if (props[y][x] === 7)
                        new Enemy(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), 1);
                    if (props[y][x] === 8)
                        new Door(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), 0);
                    if (props[y][x] === 9)
                        new Door(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), 1);
                    if (props[y][x] === 10)
                        new Door(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), 2);
                    if (props[y][x] === 11)
                        new Key(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), 0);
                    if (props[y][x] === 12)
                        new Key(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), 1);
                    if (props[y][x] === 13)
                        new Key(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), 2);
                    if (props[y][x] === 14)
                        new Chest(new Vector2(x * 16 * WORLD_SCALE.x, CANVAS_SIZE.y - (y + 1) * 16 * WORLD_SCALE.y), 2);
                }
        };

        this.SaveGame = function() {
            const saveData = [];
            let propData = JSON.parse(LoadCookie("propsSaveGame"));
            if (propData == null)
                propData = [];

            for (let i = 0; i < this.props.length; i++)
                saveData.push({ type: this.props[i].type, posX: this.props[i].pos.x, posY: this.props[i].pos.y, physics: this.props[i].physics, waypointMode: this.props[i].waypointMode, waypoints: this.props[i].waypoints, currentWaypoint: this.props[i].currentWaypoint, doorType: this.props[i].doorType });

            propData[map.activeScreen.id] = saveData;

            SaveCookie("propsSaveGame", JSON.stringify(propData));

            console.log("Data saved for screen " + map.activeScreen.id);
        };

        this.LoadGame = function() {
            let loadData = [];
            loadData = JSON.parse(LoadCookie("propsSaveGame"));

            if (loadData != null) {
                const currentData = loadData[map.activeScreen.id];

                if (currentData != null) {
                    this.Clear();

                    for (let i = 0; i < currentData.length; i++)
                        switch (currentData[i].type) {
                            case PropType.WALL:
                                new Wall(new Vector2(currentData[i].posX, currentData[i].posY));
                                break;
                            case PropType.ROCK:
                                new Rock(new Vector2(currentData[i].posX, currentData[i].posY), currentData[i].physics);
                                break;
                            case PropType.COIN:
                                new Coin(new Vector2(currentData[i].posX, currentData[i].posY));
                                break;
                            case PropType.LAVA:
                                new Lava(new Vector2(currentData[i].posX, currentData[i].posY));
                                break;
                            case PropType.ENEMY:
                                new Enemy(new Vector2(currentData[i].posX, currentData[i].posY), currentData[i].waypointMode, currentData[i].waypoints, currentData[i].currentWaypoint);
                                break;
                            case PropType.DOOR:
                                new Door(new Vector2(currentData[i].posX, currentData[i].posY), currentData[i].doorType);
                                break;
                            case PropType.KEY:
                                new Key(new Vector2(currentData[i].posX, currentData[i].posY), currentData[i].doorType);
                                break;
                            case PropType.CHEST:
                                new Chest(new Vector2(currentData[i].posX, currentData[i].posY));
                                break;
                            default:
                                break;
                        }
                } else {
                    console.log("No save data for screen " + map.activeScreen.id);
                    return false;
                }
                console.log("Save data loaded for screen " + map.activeScreen.id);
                return true;
            } else {
                console.log("No save game to load.");
                return false;
            }
        };

        this.DeleteGame = function() {
            console.log("Deleting saved game...");
            DeleteCookie("propsSaveGame");
            character.Reset();
        };
    }
}

const propMan = new PropMan();

//Prop
class Prop {
    constructor(type = PropType.UNKNOWN, pos = new Vector2(0, 0), physics = Physics.KINEMATIC, sprite) {
        this.type = type;
        this.pos = pos;
        this.scale = WORLD_SCALE;
        this.sprite = Object.assign({}, sprite);
        this.physics = physics;
        this.collider = new RectCollider(this.pos, Vector2.Mult(new Vector2(this.sprite.img[0].width, this.sprite.img[0].height), this.scale), this.physics);
        propMan.Add(this);
    }
}

//Prop - Wall
class Wall extends Prop {
    constructor(pos = new Vector2(0, 0)) {
        super(PropType.WALL, pos, Physics.KINEMATIC, wall);
    }
}

//Prop - Rock
class Rock extends Prop {
    constructor(pos = new Vector2(0, 0), physics = Physics.KINEMATIC) {
        if (physics === Physics.KINEMATIC)
            super(PropType.ROCK, pos, physics, rockHeavy);
        else
            super(PropType.ROCK, pos, physics, rock);
    }
}


//Prop - Coin
class Coin extends Prop {
    constructor(pos = new Vector2(0, 0)) {
        super(PropType.COIN, pos, Physics.TRIGGER, coin);

        this.Update = function() {
            if (this.collider.colliding) {
                //Must use playerFound variable because 'this' inside 'collidingWith.map' does not refer to the coin.
                let playerFound = false;
                this.collider.collidingWith.map(function(collider) {
                    if (collider.tag === "Player")
                        playerFound = true;
                });
                if (playerFound) {
                    character.score += 1;
                    coinSound.play();
                    propMan.Remove(this);
                }
            }
        };
    }
}


//Prop - Lava
class Lava extends Prop {
    constructor(pos = new Vector2(0, 0)) {
        super(PropType.LAVA, pos, Physics.TRIGGER, lava);

        this.Update = function() {
            if (this.collider.colliding)
                this.collider.collidingWith.map(function(collider) {
                    if (collider.tag === "Player")
                        character.Hurt(1);
                });
        };
    }
}


//Prop - Enemy
class Enemy extends Prop {
    constructor(pos = new Vector2(0, 0), waypointMode = 0, waypoints = [], currentWaypoint = 0) {
        super(PropType.ENEMY, pos, Physics.SIMULATED, enemy);

        this.waypointMode = waypointMode;
        this.waypoints = waypoints;
        if (this.waypoints.length === 0)
            if (this.waypointMode === 0)
                this.waypoints = [new Vector2(pos.x / 64 - 3, pos.y / 64), new Vector2(pos.x / 64 + 3, pos.y / 64)];
            else
                this.waypoints = [new Vector2(pos.x / 64, pos.y / 64 - 3), new Vector2(pos.x / 64, pos.y / 64 + 3)];

        this.currentWaypoint = currentWaypoint;
        this.speed = new Vector2(0.8, 0.8);

        this.Update = function() {
            //Collisions
            //Must use playerFound variable because 'this' inside 'collidingWith.map' does not refer to the enemy.
            let playerFound = false;
            let swordFound = false;
            if (this.collider.colliding) {
                this.collider.collidingWith.map(function(collider) {
                    if (collider.tag === "Player")
                        playerFound = true;
                    if (collider.tag === "Sword")
                        swordFound = true;
                });

                if (playerFound) {
                    propMan.Remove(this);
                    character.Hurt(1);
                }

                if (swordFound) {
                    character.score += 1;
                    coinSound.play();
                    propMan.Remove(this);
                    enemyDeath.play();
                }
            }

            //Movement
            const dest = Vector2.Mult(this.waypoints[this.currentWaypoint], new Vector2(64, 64));
            const dist = Vector2.Sub(dest, this.pos).Mag();

            if (dist < 68) {
                this.currentWaypoint++;
                if (this.currentWaypoint >= this.waypoints.length)
                    this.currentWaypoint = 0;
            }

            let dir = Vector2.Sub(dest, this.pos);
            dir.Normalize();
            dir = Vector2.Mult(dir, this.speed);

            this.pos = Vector2.Add(this.pos, dir);
            this.collider.pos = this.pos;
        };
    }
}

//Prop - Door
class Door extends Prop {
    constructor(pos = new Vector2(0, 0), doorType = 0) {
        super(PropType.DOOR, pos, Physics.KINEMATIC, doors);

        this.doorType = doorType;
        this.sprite.frame = this.doorType;
        this.Update = function() {
            let playerFound = false;
            if (this.collider.colliding)
                this.collider.collidingWith.map(function(collider) {
                    if (collider.tag === "Player")
                        playerFound = true;
                });
            if (playerFound && character.keys[this.doorType]) {
                coinSound.play();
                propMan.Remove(this);
            }
        };
    }
}

//Prop - Key
class Key extends Prop {
    constructor(pos = new Vector2(0, 0), doorType = 0) {
        super(PropType.KEY, pos, Physics.TRIGGER, keys);

        this.doorType = doorType;
        this.sprite.frame = this.doorType;
        this.Update = function() {
            let playerFound = false;
            if (this.collider.colliding)
                this.collider.collidingWith.map(function(collider) {
                    if (collider.tag === "Player")
                        playerFound = true;
                });
            if (playerFound) {
                character.keys[this.doorType] = true;
                coinSound.play();
                propMan.Remove(this);
            }
        };
    }
}

//Prop - Chest
class Chest extends Prop {
    constructor(pos = new Vector2(0, 0), doorType = 0) {
        super(PropType.CHEST, pos, Physics.TRIGGER, chest);

        this.Update = function() {
            if (this.collider.colliding)
                this.collider.collidingWith.map(function(collider) {
                    if (collider.tag === "Player")
                        WinCondition();
                });
        };
    }
}

const props0 = [
    [1, 1, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 3, 0,11, 0, 0, 1],
    [1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 7, 5, 1],
    [1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 7, 0, 0, 5, 1],
    [1, 0, 0, 0, 0, 4, 0, 4, 0, 4, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,10],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];
const props1 = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 4, 4, 0, 0, 0, 2, 2, 0, 0, 0, 0, 5, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 1],
    [0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 5, 0, 0, 0, 0, 9],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 1],
    [0, 0, 2, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];
const props2 = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
    [0, 5, 5, 5, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 5,12, 0, 7, 0, 0, 4, 0, 4, 0, 4, 0, 0, 2, 0],
    [0, 5, 5, 5, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
];
const props3 = [
    [1, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0,13, 0, 0],
    [1, 0, 0, 0, 5, 5, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 4, 7, 0],
    [1, 0, 0, 0, 5, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];
const props4 = [
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0,14, 0, 0],
    [1, 0, 0, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 4, 4, 0],
    [1, 0, 0, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 4, 4, 0],
    [1, 0, 0, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 4, 4, 0],
    [1, 0, 0, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 5, 5, 0, 0, 0, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    [1, 0, 0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 5, 5]
];

//_____Map & Screen_____
class Map {
    constructor(screens) {
        this.screens = screens;
        this.activeScreen = this.screens[0];

        this.SetScreen = function(screen) {
            this.activeScreen = screen;

            if (!propMan.LoadGame())
                propMan.Process(screen.props);
        };

        this.SetScreenIgnoreLoadAndClear = function(screen) {
            this.activeScreen = screen;
            propMan.Process(screen.props);
            colMan.Clear();
        };

        this.Draw = function() {
            this.activeScreen.Draw();
        };
    }
}


class Screen {
    //This was the only reliable way I found to copy a multidimensional array by value... What the hell,  Javascript?
    //Note: Shallow Copy Only - https://www.samanthaming.com/tidbits/35-es6-way-to-clone-an-array
    constructor(id, plan = JSON.parse(JSON.stringify(defaultGrid)), props = JSON.parse(JSON.stringify(defaultGrid))) {
        this.id = id;
        this.plan = JSON.parse(LoadCookie("plan" + this.id));
        if (this.plan == null) {
            console.log("Loading backup plan" + this.id);
            this.plan = plan;
            SaveCookie("plan" + this.id, JSON.stringify(this.plan));
        }

        this.props = JSON.parse(LoadCookie("props" + this.id));
        if (this.props == null) {
            console.log("Loading backup props" + this.id);
            this.props = props;
            SaveCookie("props" + this.id, JSON.stringify(this.props));
        }
        //Array mapping: https://youtu.be/Mus_vwhTCq0?t=590
        this.grid = this.plan.map(v1 => v1.map(v2 => PlanSprites(v2)));
        this.scale = WORLD_SCALE;
        this.connections = [null, null, null, null];

        //Draw sprites matching array and upside-down.
        this.Draw = function() {
            for (let x = 0; x < this.grid[0].length; x++)
                for (let y = 0; y < this.grid.length; y++)
                    if (this.grid[y][x] != null)
                        this.grid[y][x].Draw(new Vector2(x * 16 * this.scale.x, CANVAS_SIZE.y - (y + 1) * 16 * this.scale.y), this.scale);
        };

        this.UpdatePlan = function(plan) {
            this.plan = plan;
            this.grid = this.plan.map(v1 => v1.map(v2 => PlanSprites(v2)));
        };
    }
}

//Clone object: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
const PlanSprites = function(v) {
    if (v === 0)
        return null;

    if (v === 1)
        return Object.assign({}, grassGreenMoving);

    if (v === 2)
        return Object.assign({}, grassYellowMoving);
    if (v === 3)
        return Object.assign({}, grassYellow01);
    if (v === 4)
        return Object.assign({}, grassYellow02);

    if (v === 5)
        return Object.assign({}, sand);

    return null;
};

const screen0 = new Screen(0, [
    [1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 5, 1],
    [1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1],
    [1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 1],
    [1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 5, 2, 3, 5, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 5, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1]
], props0);
const screen1 = new Screen(1, [
    [5, 5, 5, 5, 5, 5, 5, 1, 1, 5, 5, 5, 5, 5, 5, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 5, 1, 5, 5, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 5, 1, 5, 5, 1],
    [1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 1, 5, 1, 5, 5, 1],
    [1, 1, 5, 5, 5, 5, 5, 5, 4, 4, 1, 5, 5, 5, 5, 1],
    [1, 1, 1, 5, 5, 5, 4, 2, 4, 5, 1, 1, 1, 5, 5, 1],
    [1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 1, 5, 5, 0],
    [1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 5, 1],
    [1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 5, 1]
], props1);
const screen2 = new Screen(2, [
    [3, 4, 3, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1],
    [4, 5, 5, 5, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1],
    [4, 5, 4, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1],
    [3, 0, 0, 0, 3, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1],
    [3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1],
    [4, 4, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1],
    [4, 2, 4, 4, 4, 4, 4, 4, 4, 5, 5, 2, 2, 2, 1, 1],
    [4, 4, 4, 3, 4, 4, 4, 2, 4, 4, 4, 4, 4, 2, 1, 1],
    [4, 4, 4, 4, 4, 2, 4, 4, 4, 4, 4, 2, 4, 4, 4, 1]
], props2);
const screen3 = new Screen(3, [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1],
    [5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
], props3);
const screen4 = new Screen(4, [
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 1],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 1, 5],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 5, 5],
    [5, 5, 3, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [3, 2, 4, 4, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 4, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
], props4);

screen0.connections = [screen1, screen4, null, null];
screen1.connections = [null, screen3, screen0, screen2];
screen2.connections = [null, screen1, null, null];
screen3.connections = [null, null, null, screen1];
screen4.connections = [null, null, null, screen0];

const screens = [screen0, screen1, screen2, screen3, screen4];
const map = new Map(screens);

//Scene Manager
class SceneMan {
    constructor() {
        this.currentScene = Scenes.NONE;

        this.Load = function(scene) {
            input.Reset();

            if (scene === Scenes.GAME)
                GameInit();
            if (scene === Scenes.EDITOR)
                EditorInit();

            this.currentScene = scene;
        };
    }
}

const sceneMan = new SceneMan();


//_____Main Game_____
//Start Game
sceneMan.Load(Scenes.MAINMENU);
MainLoop();

//Main loop - Ref: https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing
function MainLoop() {
    //Clear canvas
    time.Update();
    context.clearRect(0, 0, CANVAS_SIZE.x, CANVAS_SIZE.y);
    contextUI.fillStyle = "black";
    contextUI.fillRect(0, 0, canvasUI.width, canvasUI.height);

    //Draw Colliders
    if (input.GetKeyDown(Keys.C))
        drawColliders = !drawColliders;

    //Editor
    if (input.GetKeyDown(Keys.L)) {
        editing = !editing;
        if (editing) {
            propMan.DeleteGame();
            sceneMan.Load(Scenes.EDITOR);
        } else {
            SaveCookie("plan" + map.activeScreen.id, JSON.stringify(map.activeScreen.plan));
            SaveCookie("props" + map.activeScreen.id, JSON.stringify(map.activeScreen.props));
            propMan.SaveGame();
            sceneMan.Load(Scenes.GAME);
        }
    }

    if (input.GetKeyDown(Keys.Num1))
        if (sceneMan.currentScene === Scenes.GAME) {
            SaveCharacter();
            propMan.SaveGame(map.activeScreen.id);
        } else
            console.log("Cannot save game from a menu!");

    if (input.GetKeyDown(Keys.Num2)) {
        sceneMan.Load(Scenes.GAME);
        LoadCharacter();
    }
    if (input.GetKeyDown(Keys.Num0))
        propMan.DeleteGame();

    colMan.CalcCollisions();

    if (sceneMan.currentScene === Scenes.MAINMENU)
        MainMenuLoop();
    if (sceneMan.currentScene === Scenes.GAME)
        GameLoop();
    if (sceneMan.currentScene === Scenes.WIN)
        WinLoop();
    if (sceneMan.currentScene === Scenes.LOSS)
        LossLoop();
    if (sceneMan.currentScene === Scenes.EDITOR)
        EditorLoop();

    //UI
    //Hearts
    for (let i = 0; i < character.health; i++)
        heart.DrawUI(new Vector2(16 + 70 * i, 32), WORLD_SCALE);
    border3.DrawUI(new Vector2(6, 28), WORLD_SCALE);
    //Weapon - Only one weapon for now.
    swordStatic.DrawUI(new Vector2(284, 32), WORLD_SCALE);
    border1.DrawUI(new Vector2(280, 28), WORLD_SCALE);
    //Keys
    border3.DrawUI(new Vector2(400, 28), WORLD_SCALE);
    for (let i = 0; i < character.keys.length; i++)
        if (character.keys[i]) {
            keys.frame = i;
            keys.DrawUI(new Vector2(410 + 70 * i, 32), WORLD_SCALE);
        }

    //Draw text
    contextUI.fillStyle = "#FFFFFF";
    contextUI.font = "16px Verdana";
    contextUI.fillText("FPS: " + (1 / time.deltaTime).toFixed(2), CANVAS_SIZE_UI.x - 100, 16);
    contextUI.font = "36px Verdana";
    contextUI.fillText("Score: " + character.score, CANVAS_SIZE_UI.x - 180, CANVAS_SIZE_UI.y - 48);

    //Loop
    requestAnimationFrame(MainLoop);

    //Events are triggered in requestAnimationFrame, so we reset input here.
    input.Reset();
}


//Game Scene
//Game Initialization
function GameInit() {
    colMan.Clear();
    propMan.Clear();
    character.Revive();

    LoadCharacter();
}


//Game Loop
function GameLoop() {
    GameLogic();
    GameDraw();
}


//Game logic
function GameLogic() {
    //Prop manager
    propMan.Update();

    //Character direction
    charDir = new Vector2(0, 0);


    if (input.GetKey(Keys.D))
        charDir.x += 1;
    if (input.GetKey(Keys.A))
        charDir.x -= 1;
    if (input.GetKey(Keys.W))
        charDir.y += 1;
    if (input.GetKey(Keys.S))
        charDir.y -= 1;

    character.Move(charDir);
    character.Update();

    //Character screen movement
    const charHalfWidth = character.sprite.img[0].width * character.scale.x / 2;
    const charHalfHeight = character.sprite.img[0].height * character.scale.y / 2;

    //Character went UP
    if (character.pos.y > CANVAS_SIZE.y - charHalfHeight)
        if (map.activeScreen.connections[0] != null) {
            propMan.SaveGame();
            map.SetScreen(map.activeScreen.connections[0]);
            character.SetPos(new Vector2(character.pos.x, -charHalfHeight + 32));
            SaveCharacter();
        } else
            character.SetPosY(CANVAS_SIZE.y - charHalfHeight);

    //Character went RIGHT
    if (character.pos.x > CANVAS_SIZE.x - charHalfWidth)
        if (map.activeScreen.connections[1] != null) {
            propMan.SaveGame();
            map.SetScreen(map.activeScreen.connections[1]);
            character.SetPos(new Vector2(-charHalfWidth + 32, character.pos.y));
            SaveCharacter();
        } else
            character.SetPosX(CANVAS_SIZE.x - charHalfWidth);

    //Character went DOWN
    if (character.pos.y < -charHalfHeight)
        if (map.activeScreen.connections[2] != null) {
            propMan.SaveGame();
            map.SetScreen(map.activeScreen.connections[2]);
            character.SetPos(new Vector2(character.pos.x, CANVAS_SIZE.y - charHalfHeight - 32));
            SaveCharacter();
        } else
            character.SetPosY(-charHalfHeight);

    //Character went LEFT
    if (character.pos.x < -charHalfWidth)
        if (map.activeScreen.connections[3] != null) {
            propMan.SaveGame();
            map.SetScreen(map.activeScreen.connections[3]);
            character.SetPos(new Vector2(CANVAS_SIZE.x - charHalfWidth - 32, character.pos.y));
            SaveCharacter();
        } else
            character.SetPosX(-charHalfWidth);
}


//Game Draw
function GameDraw() {
    //Draw sprites
    map.Draw();
    propMan.Draw();
    character.Draw();

    //Draw coliders
    if (drawColliders)
        colMan.Draw();
}

//Win & Loss
function WinCondition() {
    sceneMan.Load(Scenes.WIN);
}
function LossCondition() {
    map.activeScreen = screens[0];
    sceneMan.Load(Scenes.LOSS);
}


//Main Menu Scene
function MainMenuLoop() {
    //Main Menu Logic
    if (input.GetKeyDown(Keys.Space))
        sceneMan.Load(Scenes.GAME);

    //Main Menu Draw
    mainmenu.Draw(new Vector2(0, 0), new Vector2(16 * 4, 9 * 4));

    context.font = "20px Verdana";
    context.fillStyle = "#000000";
    context.fillText("Press SPACE to begin your adventure.", CANVAS_SIZE.x / 2 - 160, CANVAS_SIZE.y / 2 + 80);
}

//Loss Scene
function LossLoop() {
    //Loss Logic
    if (input.GetKeyDown(Keys.Escape))
        sceneMan.Load(Scenes.MAINMENU);
    if (input.GetKeyDown(Keys.Space))
        sceneMan.Load(Scenes.GAME);

    //Loss Draw
    mainmenu.Draw(new Vector2(0, 0), new Vector2(16 * 4, 9 * 4));

    //Draw text
    context.font = "20px Verdana";
    context.fillStyle = "#000000";
    context.fillText("You lost!", CANVAS_SIZE.x / 2 - 160, CANVAS_SIZE.y / 2 + 80);
    context.fillText("Press SPACE to retry your adventure.", CANVAS_SIZE.x / 2 - 160, CANVAS_SIZE.y / 2 + 80 + 20);
    context.fillText("Or Escape to give up.", CANVAS_SIZE.x / 2 - 160, CANVAS_SIZE.y / 2 + 80 + 40);
}


//Win Scene
function WinLoop() {
    //Win Logic
    if (input.GetKeyDown(Keys.Escape)) {
        propMan.DeleteGame();
        sceneMan.Load(Scenes.MAINMENU);
        character.Reset();
    }
    if (input.GetKeyDown(Keys.Space)) {
        propMan.DeleteGame();
        sceneMan.Load(Scenes.GAME);
        character.Reset();
    }

    //Win Draw
    mainmenu.Draw(new Vector2(0, 0), new Vector2(16 * 4, 9 * 4));

    //Draw text
    context.font = "20px Verdana";
    context.fillStyle = "#000000";
    context.fillText("You win!", CANVAS_SIZE.x / 2 - 160, CANVAS_SIZE.y / 2 + 80);
    context.fillText("Press SPACE to begin your adventure again.", CANVAS_SIZE.x / 2 - 160, CANVAS_SIZE.y / 2 + 80 + 20);
    context.fillText("Or Escape to leave.", CANVAS_SIZE.x / 2 - 160, CANVAS_SIZE.y / 2 + 80 + 40);
}


//Editor
let editingPlan;
let editingProps;
let itemID = 0;
let editMode = false;
const editModeItems = [
    ["Remove", "Grass Green (Moving)", "Grass Yellow (Moving)", "Grass Yellow 1", "Grass Yellow 2", "Sand"],
    ["Remove", "Wall", "Rock (Small)", "Rock (Large)", "Coin", "Lava", "Enemy (Patrol Horizontally)", "Enemy (Patrol Vertically)", "Door - Red", "Door - Green", "Door - Blue", "Key - Red", "Key - Green", "Key - Blue", "Chest"]
];

//Editor Init
function EditorInit() {
    map.SetScreenIgnoreLoadAndClear(screens[0]);
    editingPlan = map.activeScreen.plan;
    editingProps = map.activeScreen.props;
}

//Editor Loop
function EditorLoop() {
    if (input.GetKeyDown(Keys.M))
        editMode = !editMode;

    if (input.GetKeyDown(Keys.Alpha1))
        itemID = 1;
    if (input.GetKeyDown(Keys.Alpha2))
        itemID = 2;
    if (input.GetKeyDown(Keys.Alpha3))
        itemID = 3;
    if (input.GetKeyDown(Keys.Alpha4))
        itemID = 4;
    if (input.GetKeyDown(Keys.Alpha5))
        itemID = 5;
    if (input.GetKeyDown(Keys.Alpha6))
        itemID = 6;
    if (input.GetKeyDown(Keys.Alpha7))
        itemID = 7;
    if (input.GetKeyDown(Keys.Alpha8))
        itemID = 8;
    if (input.GetKeyDown(Keys.Alpha9))
        itemID = 9;

    //UP
    if (input.GetKeyDown(Keys.W))
        if (map.activeScreen.connections[0] != null) {
            SaveCookie("plan" + map.activeScreen.id, JSON.stringify(map.activeScreen.plan));
            SaveCookie("props" + map.activeScreen.id, JSON.stringify(map.activeScreen.props));
            map.SetScreenIgnoreLoadAndClear(map.activeScreen.connections[0]);
            editingPlan = map.activeScreen.plan;
            editingProps = map.activeScreen.props;
        }

    //RIGHT
    if (input.GetKeyDown(Keys.D))
        if (map.activeScreen.connections[1] != null) {
            SaveCookie("plan" + map.activeScreen.id, JSON.stringify(map.activeScreen.plan));
            SaveCookie("props" + map.activeScreen.id, JSON.stringify(map.activeScreen.props));
            map.SetScreenIgnoreLoadAndClear(map.activeScreen.connections[1]);
            editingPlan = map.activeScreen.plan;
            editingProps = map.activeScreen.props;
        }

    //DOWN
    if (input.GetKeyDown(Keys.S))
        if (map.activeScreen.connections[2] != null) {
            SaveCookie("plan" + map.activeScreen.id, JSON.stringify(map.activeScreen.plan));
            SaveCookie("props" + map.activeScreen.id, JSON.stringify(map.activeScreen.props));
            map.SetScreenIgnoreLoadAndClear(map.activeScreen.connections[2]);
            editingPlan = map.activeScreen.plan;
            editingProps = map.activeScreen.props;
        }

    //LEFT
    if (input.GetKeyDown(Keys.A))
        if (map.activeScreen.connections[3] != null) {
            SaveCookie("plan" + map.activeScreen.id, JSON.stringify(map.activeScreen.plan));
            SaveCookie("props" + map.activeScreen.id, JSON.stringify(map.activeScreen.props));
            map.SetScreenIgnoreLoadAndClear(map.activeScreen.connections[3]);
            editingPlan = map.activeScreen.plan;
            editingProps = map.activeScreen.props;
        }


    //Define red selection box location
    //Prevent grid selection outside of level size.
    const selectPos = new Vector2(Math.min(input.mousePos.x - input.mousePos.x % 64, 64 * 15), Math.min(input.mousePos.y - input.mousePos.y % 64, 64 * 8));
    const selectGrid = new Vector2(selectPos.x / 64, selectPos.y / 64);

    if (input.mouseWheel === 1)
        itemID--;
    if (input.mouseWheel === -1)
        itemID++;

    if (itemID < 1)
        itemID = 1;

    if (editMode) {
        if (itemID > editModeItems[1].length - 1)
            itemID = editModeItems[1].length - 1;
        if (input.GetClick(0)) {
            editingProps[selectGrid.y][selectGrid.x] = itemID;
            map.activeScreen.props = editingProps;
            propMan.Process(editingProps);
            colMan.Clear();
        } else if (input.GetClick(2)) {
            editingProps[selectGrid.y][selectGrid.x] = 0;
            map.activeScreen.props = editingProps;
            propMan.Process(editingProps);
            colMan.Clear();
        }
    } else {
        if (itemID > editModeItems[0].length - 1)
            itemID = editModeItems[0].length - 1;
        if (input.GetClick(0)) {
            editingPlan[selectGrid.y][selectGrid.x] = itemID;
            map.activeScreen.UpdatePlan(editingPlan);
        } else if (input.GetClick(2)) {
            editingPlan[selectGrid.y][selectGrid.x] = 0;
            map.activeScreen.UpdatePlan(editingPlan);
        }
    }


    //Editor - Draw
    map.Draw();
    propMan.Draw();
    //Draw red selection box
    context.strokeStyle = "red";
    context.strokeRect(selectPos.x, selectPos.y, 64, 64);

    context.font = "28px Verdana";
    context.strokeStyle = "#000000";
    context.fillStyle = "#FFFFFF";
    context.textAlign = "center";
    if (editMode) {
        context.fillText("Editor Mode - PROP: " + editModeItems[1][itemID], CANVAS_SIZE.x / 2, 100);
        context.strokeText("Editor Mode - PROP: " + editModeItems[1][itemID], CANVAS_SIZE.x / 2, 100);
    } else {
        context.fillText("Editor Mode - MAP: " + editModeItems[0][itemID], CANVAS_SIZE.x / 2, 100);
        context.strokeText("Editor Mode - MAP: " + editModeItems[0][itemID], CANVAS_SIZE.x / 2, 100);
    }
    context.textAlign = "left";
}
