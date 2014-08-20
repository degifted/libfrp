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
