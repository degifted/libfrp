Module = function(inputPorts, callback, desc) {
    if (this instanceof Module) {
        this.inputPorts = inputPorts;
        this.callback = callback;
        this.desc = desc;
        this.pendingInputData = {};
        this.portBindings = {};
        return this;
    } else {
        return function() {return new Module(inputPorts, callback, desc);};
    }
}

Module.prototype.connect = function(portName, wireName, bus){
    var wire;
    if (bus[wireName]){
        wire = bus[wireName];
    } else {
        wire = bus.newWire(wireName);
    }
    wire.connectedModules.push({
        "module": this,
        "portName": portName
    });
    this.portBindings[portName] = wire;
    return this;
}

Module.prototype.return = function(output){
    for (var portName in output){
        var wire = this.portBindings[portName];
        wire.send(output[portName]);
    }
}

Bus = function(){}

Bus.prototype.newWire = function(wireName){
    this[wireName] = new Wire();
    this[wireName].connectedModules = [];
    this[wireName].name = wireName;
    return this[wireName];
}

Wire = function(){}

Wire.prototype.send = function(msg){
    for (var idx in this.connectedModules){
        var module = this.connectedModules[idx].module;
        var portName = this.connectedModules[idx].portName;
        if (module.inputPorts.indexOf(portName) != -1){
            module.pendingInputData[portName] = msg;
            if (Object.keys(module.pendingInputData).length == module.inputPorts.length){
                var inputs = module.pendingInputData;
                module.pendingInputData = {};
                module.callback(inputs);
            }
        }
    }
}







$(document).ready(function() {








    wires = new Bus();




    Test = Module (
        [],
        function () {
            console.log("Test");
        }, "Test Module");



    new Module (
        ["inA", "inB"],
        function (inputs) {
            this.return({
                "outA": inputs.inA + inputs.inB,
                "outB": 3
            });
        }, "Module m1")
        .connect("inA", "w1", wires)
        .connect("inB", "w2", wires)
        .connect("outA", "w3", wires)
        .connect("outB", "w4", wires);



    m2 = new Module (
        ["inA", "inB"],
        function (inputs) {
            this.return({
                "outA": inputs.inA - inputs.inB,
                "outB": 33
            });
        }, "Module m2")
        .connect("inA", "w3", wires)
        .connect("inB", "w4", wires)
        .connect("outA", "w5", wires)
        .connect("outB", "w6", wires);



    m3 = new Module (
        ["inC"],
        function (inputs) {
            console.log(inputs.inC);
        }, "Module m3")
        .connect("inC", "w5", wires);



    m4 = Test();

    m5 = new Module (
        [],
        function () {
            console.log("Test");
        }, "Test Module");










    wires.w1.send(5);
    wires.w2.send(53);

    wires.w5.send(58);





    

    var g = new Graph();

     
    g.addEdge("strawberry", "cherry", { label : "Meat-to-Apple" });
    g.addEdge("strawberry", null);
    g.addEdge("strawberry", "apple");
    g.addEdge("strawberry", "tomato");
     
    g.addEdge("tomato", "apple");
    g.addEdge("tomato", "kiwi");
     
    g.addEdge("cherry", "apple");
    g.addEdge("cherry", "kiwi");
     
    var layouter = new Graph.Layout.Spring(g);
    layouter.layout();
     
    var renderer = new Graph.Renderer.Raphael('canvas', g, 400, 300);
    renderer.draw();
    
});