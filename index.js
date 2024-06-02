var http = require("http");
var fs = require("fs");

//Read settings
var colors = fs.readFileSync("./config/colors.txt").toString().replace(/\r/,"").split("\n");
var blacklist = fs.readFileSync("./config/blacklist.txt").toString().replace(/\r/,"").split("\n");
var config = JSON.parse(fs.readFileSync("./config/config.json"));
if(blacklist.includes("")) blacklist = []; //If the blacklist has a blank line, ignore the whole list.

var markup = require("./markup.js");

//Variables
var rooms = {};
var users = {};
var guidcounter = 0;
var server = http.createServer((req, res) => {
    //HTTP SERVER (not getting express i won't use 99% of its functions for a simple project)
    fname = "index.html";
    if (fs.existsSync("./frontend/" + req.url) && fs.lstatSync("./frontend/" + req.url).isFile()) {
        data = fs.readFileSync("./frontend/" + req.url);
        fname = req.url;
    } else {
        data = fs.readFileSync("./frontend/index.html");
    }
    fname.endsWith(".js") ? res.writeHead(200, { "Content-Type": "text/javascript" }) : res.writeHead(200, {});
    if(!req.url.includes("../")) res.write(data);
    res.end();
});

//Socket.io Server
var io = require("socket.io")(server, {
    allowEIO3: true
}
);
server.listen(config.port, () => {
    rooms["default"] = new room("default");
    console.log("running at http://bonzi.localhost:" + config.port);
});
io.on("connection", (socket) => {
    new user(socket);
});

//Now for the fun!

//Command list
var commands = {
  //normal commands
  name:(victim,param)=>{
    if (param == "" || param.length > config.namelimit || victim.statlocked) return;
    if (victim.markup) {
      victim.public.name = markup(param, true);
      victim.public.dispname = markup(param);
    }
    else {
      victim.public.name = param;
      victim.public.dispname = param;
    }
    victim.room.emit("update",{guid:victim.public.guid,userPublic:victim.public})
  },
  
  asshole:(victim,param)=>{
  victim.room.emit("asshole",{
    guid:victim.public.guid,
    target:param,
  })
  },
    
  color:(victim, param)=>{
    if(!param && !colors.includes(param)))
      param = colors[Math.floor(Math.random() * colors.length)];
    victim.public.color = param;
    victim.room.emit("update",{guid:victim.public.guid,userPublic:victim.public})
  }, 
  
  pitch:(victim, param)=>{
    param = parseInt(param);
    if(isNaN(param)) return;
    victim.public.pitch = param;
    victim.room.emit("update",{guid:victim.public.guid,userPublic:victim.public})
  },

  speed:(victim, param)=>{
    param = parseInt(param);
    if(isNaN(param) || param>400) return;
    victim.public.speed = param;
    victim.room.emit("update",{guid:victim.public.guid,userPublic:victim.public})
  },

  joke:(victim, param)=>{
    victim.room.emit("joke", {guid:victim.public.guid, rng:Math.random()})
  },
  
  fact:(victim, param)=>{
    victim.room.emit("fact", {guid:victim.public.guid, rng:Math.random()})
  },
  
  backflip:(victim, param)=>{
    victim.room.emit("backflip", {guid:victim.public.guid, swag:(param.toLowerCase() == "swag")})
  },
  
  owo:(victim, param)=>{
  victim.room.emit("owo",{
    guid:victim.public.guid,
    target:param,
  })
  },

  triggered:(victim, param)=>{
    victim.room.emit("triggered", {guid:victim.public.guid})
  },

  linux:(victim, param)=>{
    victim.room.emit("linux", {guid:victim.public.guid})
  },

  youtube:(victim, param)=>{
    victim.room.emit("youtube",{guid:victim.public.guid, vid:param.replace(/"/g, "&quot;")})
  },

  hail:(victim, param)=>{
    victim.room.emit("hail",{guid:victim.public.guid,user:param});
  },

  nigger:(victim, param)=>{
    victim.room.emit("talk",{guid:victim.public.guid, text:"Seamus is a nigger!"});
    victim.lastMessage = "Seamus is a nigger!";
  },

  emote:(victim, param)=>{
    victim.room.emit("emote", {guid:victim.public.guid,type:param});
  },

  background:(victim, param)=>{
    victim.socket.emit("background", {bg:param});
  },

  image:(victim, param)=>{
    victim.room.emit("talk",{guid:victim.public.guid,text:`<img class='userimage' src='${param.replace(/'/g, "&apos;")}'>`});
  },

  markup:(victim, param)=>{
    switch (param.toLowerCase()) {
      case "off":
      case "false":
      case "no":
      case "n":
      case "0":
        victim.markup = false;
      break;
      default:
        victim.markup = true;
      break;
    }
  },

  //blessed commands
  announce:(victim, param)=>{
    if (victim.level < 1 && victim.public.color != "blessed") return;
    victim.room.emit("announcement", {from:victim.public.name,msg:param});
  },

  //room owner commands
  king:(victim, param)=>{
    if(victim.level<1) return;
    victim.public.color = "king";
    victim.room.emit("update",{guid:victim.public.guid,userPublic:victim.public})
  },

  jewify:(victim, param)=>{
    if(victim.level<1 || !victim.room.usersPublic[param]) return;
    victim.room.usersPublic[param].color = "jew";
    victim.room.emit("update",{guid:param,userPublic:victim.room.usersPublic[param]});
  },

  bless:(victim, param)=>{
    if(victim.level<1 || !victim.room.usersPublic[param]) return;
    victim.room.usersPublic[param].color = "blessed";
    victim.room.emit("update",{guid:param,userPublic:victim.room.usersPublic[param]});
  },

  massbless:(victim, param)=>{
    if(victim.level<1) return;
    for (var i = 0; i < victim.room.users.length; ++i) {
      if (victim.room.users[i].level < 1) {
        victim.room.users[i].public.color = "blessed";
        victim.room.emit("update",{guid:victim.room.users[i].public.guid,userPublic:victim.room.users[i].public});
      }
    }
  },

  //king commands
  kingmode:(victim, param)=>{
    if(param == config.kingword) victim.level = 1;
    victim.socket.emit("authlv",{level:1});
  },

  sanitize:(victim, param)=>{
    if(victim.level<1) return;
    if(victim.sanitize) victim.sanitize = false;
    else victim.sanitize = true;
  },

  kick:(victim, param)=>{
    if(victim.level<2 || !victim.room.usersPublic[param]) return;
    users[param].socket.emit("kick",victim.public.name);
    users[param].socket.disconnect();
  },

  //pope commands
  godmode:(victim, param)=>{
    if(param == config.godword) victim.level = 2;
    victim.socket.emit("authlv",{level:2});
  },

  pope:(victim, param)=>{
    if(victim.level<2) return;
    victim.public.color = "pope";
    victim.public.tagged = true;
    victim.public.tag = "Owner";
    victim.room.emit("update",{guid:victim.public.guid,userPublic:victim.public})
  },

  restart:(victim, param)=>{
    if(victim.level<2) return;
    for (thing in rooms)
      rooms[thing].emit("errr", {code: 104});
    process.exit();
  },

  update:(victim, param)=>{
    if(victim.level<2) return;
    //Just re-read the settings.
    colors = fs.readFileSync("./config/colors.txt").toString().replace(/\r/,"").split("\n");
    blacklist = fs.readFileSync("./config/blacklist.txt").toString().replace(/\r/,"").split("\n");
    config = JSON.parse(fs.readFileSync("./config/config.json"));
    if(blacklist.includes("")) blacklist = []; 
  },
}

//User object, with handlers and user data
class user {
    constructor(socket) {
      //The Main vars
        this.socket = socket;
        this.loggedin = false;
        this.level = 0; //This is the authority level
        this.public = {};
        this.slowed = false; //This checks if the client is slowed
        this.sanitize = true;
        this.markup = true;
        this.lastMessage = "";
        //lol wtf fune, why do you have a backdoor that lets you stop the server without godmode
        //this.socket.on("7eeh8aa", ()=>{process.exit()});
        this.socket.on("login", (logdata) => {
          if(typeof logdata !== "object" || typeof logdata.name !== "string" || typeof logdata.room !== "string") return;
          //Filter the login data
            if (logdata.name == undefined || logdata.room == undefined) logdata = { room: "default", name: "Anonymous" };
          (logdata.name == "" || logdata.name.length > config.namelimit || filtertext(logdata.name)) && (logdata.name = "Anonymous");
          logdata.name.replace(/ /g,"") == "" && (logdata.name = "Anonymous");
            if (this.loggedin == false) {
                else {
                  clientslowmode.push(this.socket.IP);
                  setTimeout(() => {
                    for (var i = 0; i < clientslowmode.length; ++i)
                      if (clientslowmode[i] == this.socket.IP) {
                        clientslowmode.splice(i, 1);
                        break;
                      }
                  }, config.altslowmode);
                }
              //If not logged in, set up everything
                this.loggedin = true;
                this.public.name = markup(logdata.name, true);
                this.public.dispname = markup(logdata.name);
                this.public.typing = "";
                this.public.color = colors[Math.floor(Math.random()*colors.length)];
                this.public.pitch = 15 + Math.round(Math.random() * 110);
                this.public.speed = 125 + Math.round(Math.random() * 150);
                guidcounter++;
                this.public.guid = guidcounter;
                users[guidcounter] = this;
                var roomname = logdata.room;
                if(roomname == "") roomname = "default";
                if(rooms[roomname] == undefined) rooms[roomname] = new room(roomname);
                this.room = rooms[roomname];
                this.room.users.push(this);
                this.room.usersPublic[this.public.guid] = this.public;
                if (!isPublicRoom(this.room.name) && Object.keys(this.room.usersPublic).length == 1) {
                  this.room.owner = this.public.guid;
                  this.level = 1;
                  this.socket.emit("authlv",{level:1});
                }
              //Update the new room
                this.socket.emit("updateAll", { usersPublic: this.room.usersPublic });
                this.room.emit("update", { guid: this.public.guid, userPublic: this.public }, this);
            }
          //Send room info
          this.socket.emit("room",{
            room:this.room.name,
            isOwner:!isPublicRoom(this.room.name) && Object.keys(this.room.usersPublic).length == 1,
            isPublic:isPublicRoom(this.room.name)
          });
          this.room.emit("serverdata",{count:this.room.users.length});
        });
      
      //talk
        this.socket.on("talk", (msg) => {
          if(typeof msg !== "object" || typeof msg.text !== "string" || this.muted == 1 || this.muted == 2) return;
          //filter
          if(this.sanitize) msg.text = msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[\[/g, "&#91;&#91;");
          if(filtertext(msg.text) && this.sanitize) msg.text = "HEY EVERYONE LOOK AT ME I'M TRYING TO SCREW WITH THE SERVER LMAO";
          


          msg.text = this.markup ? markup(msg.text) : msg.text;
              this.room.emit("talk", { guid: this.public.guid, text: msg.text });
              this.lastMessage = msg.text;
        });

        this.socket.on("dm", (msg) => {
          if(typeof msg !== "object" || typeof msg.msg !== "string") return;
          //filter
          if(this.sanitize) msg.msg = msg.msg.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[\[/g, "&#91;&#91;");
          if(filtertext(msg.msg) && this.sanitize) msg.msg = "HEY EVERYONE LOOK AT ME I'M TRYING TO SCREW WITH THE SERVER LMAO";
          
          msg.msg = this.markup ? markup(msg.msg) : msg.msg;

          //talk
            if(this.room.usersPublic[msg.guid]){
              users[msg.guid].socket.emit("talk", { guid: this.public.guid, text: msg.msg + "<h5>(Only you can see this!)</h5>"});
              this.socket.emit("talk", { guid: this.public.guid, text: msg.msg + `<h5>(Message sent to ${users[msg.guid].public.name})</h5>`});
            }
        });

        this.socket.on("quote", (msg) => {
          if(typeof msg !== "object" || typeof msg.msg !== "string") return;
          //filter
          if(this.sanitize) msg.msg = msg.msg.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[\[/g, "&#91;&#91;");
          if(filtertext(msg.msg) && this.sanitize) msg.msg = "HEY EVERYONE LOOK AT ME I'M TRYING TO SCREW WITH THE SERVER LMAO";

          msg.msg = this.markup ? markup(msg.msg) : msg.msg;

          //talk
            if(this.room.usersPublic[msg.guid]){
              this.room.emit("talk", { guid: this.public.guid, text: `<div class='quote'>${users[msg.guid].lastMessage}</div> ${msg.msg}` });
              this.lastMessage = msg.msg;
            }
        });

      //Deconstruct the user on disconnect
        this.socket.on("disconnect", () => {
          if (this.loggedin) {
            delete this.room.usersPublic[this.public.guid];
            this.room.emit("leave", { guid: this.public.guid });
            this.room.users.splice(this.room.users.indexOf(this), 1);
            this.room.emit("serverdata",{count:this.room.users.length});
            delete users[this.public.guid];
            if (this.room.owner) {
              if (this.room.users.length == 0) {
                delete rooms[this.room.name];
                delete this.room;
              }
              else if (this.room.owner == this.public.guid) {
                var newOwner = this.room.users[Math.round(Math.random() * (this.room.users.length - 1))];
                this.room.owner = newOwner.public.guid;
                newOwner.socket.emit("room",{isOwner:true,isPublic:false,room:this.room.name});
                if (newOwner.level < 1) {
                  newOwner.level = 1;
                  newOwner.socket.emit("authlv",{level:1});
                }
              }
            }
          }
        });

      //COMMAND HANDLER
      this.socket.on("command",cmd=>{
        //parse and check
        if(cmd.list[0] == undefined) return;
        var comd = cmd.list[0];
        var param = ""
        if(cmd.list[1] == undefined) param = [""]
        else{
        param=cmd.list;
        param.splice(0,1);
        }
        param = param.join(" ");
          //filter
          if(typeof param !== 'string') return;
          if(this.sanitize) param = param.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[\[/g, "&#91;&#91;");
          if(filtertext(param) && this.sanitize) return;
          if(commands[comd] !== undefined) commands[comd](this, param);
      });

      this.socket.on("typing", type => {
        if (this.muted != 0 || typeof this.room == "undefined") return;
        switch (type.state) {
          case 0:
            this.public.typing = "";
          break;
          case 1:
            this.public.typing = " (typing)";
          break;
          case 2:
            this.public.typing = " (commanding)";
          break;
        }
        this.room.emit("update",{guid:this.public.guid,userPublic:this.public});
      });
    }
}

//Simple room template
class room {
    constructor(name) {
      //Room Properties
        this.name = name;
        this.users = [];
        this.usersPublic = {};
        this.owner = 0;
    }

  //Function to emit to every room member
    emit(event, msg, sender) {
        this.users.forEach((user) => {
            if(user !== sender)  user.socket.emit(event, msg)
        });
    }
}

//Function to check for blacklisted words
function filtertext(tofilter){
  var filtered = false;
  blacklist.forEach(listitem=>{
    if(tofilter.includes(listitem)) filtered = true;
  })
  return filtered;
}

function isPublicRoom(id) {
  return id == "default" || id == "desanitize";
}