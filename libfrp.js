Module = function(arg1, arg2) {
    if (this instanceof Module) {
        this.bus = new Bus();
        this.storage = {};
        if (arguments.length == 2) {
            this.name = arg2;
            arg1.bind(this)();
        } else {
            this.name = arg1[1];
            arg1[0].bind(this)();
        }
        return this;
    } else {
        return [arg1, arg2];
    }
}

Module.prototype.Module = function(arg1, arg2) {
    var module = Object.create(Module.prototype);
    module.parentBus = this.bus;
    module.bus = new Bus();
    module.storage = {};
    if (arguments.length == 2) {
        module.name = arg2;
        arg1.bind(this)();
    } else {
        module.name = arg1[1];
        arg1[0].bind(this)();
    }
    return module;
}

Module.prototype.connect = function(wires){
    for (var wireName in wires) {
        this.parentBus[wireName].connectWire(wires[wireName]);
        wires[wireName].connectWire(this.parentBus[wireName]);
    }
}

Module.prototype.Unit = function(arg1, arg2) {
    var unit = Object.create(Unit.prototype);
    if (arguments.length == 2) {
        unit.callback = arg1;
        unit.name = arg2;
    } else {
        unit.callback = arg1[0];
        unit.name = arg1[1];
    }
    unit.inputPorts = unit.callback.toString().match(/function.*\(([\w,\s]*)\)/)[1].split(/\s*,\s*/);
    unit.pendingInputData = {};
    unit.portBindings = {};
    unit.module = this;
    return unit;
}

Module.prototype.Storage = function(data){
    for (var storageMethod in data){
        for (var wireName in data[storageMethod]){
            var storageCell = data[storageMethod][wireName];
            switch (storageMethod){
                case "log":
                    this.bus[wireName].connectProbe(function(signal){
                        if (!this.storage[this.storageCell])
                            this.storage[this.storageCell] = [];
                        this.storage[this.storageCell].push(signal);
                    }.bind({
                        "storage": this.storage,
                        "storageCell": storageCell
                    }));
                    break;
                case "store":
                    this.bus[wireName].connectProbe(function(signal){
                        this.storage[this.storageCell] = signal;
                    }.bind({
                        "storage": this.storage,
                        "storageCell": storageCell
                    }));
                    break;
            }
        }
    }
}

Module.prototype.recall = function(storageCell){
    return this.storage[storageCell];
}

Unit = function(callback, name) {
        return [callback, name];
}

Unit.prototype.connect = function(portWirePairs){
    for (var portName in portWirePairs){
        var wireName = portWirePairs[portName];
        if (this.module.bus[wireName]){
            var wire = this.module.bus[wireName];
        } else {
            var wire = this.module.bus.newWire(wireName);
        }
        wire.connectedUnits.push({
            "unit": this,
            "portName": portName
        });
        this.portBindings[portName] = wire;
    }
    return this;
}

Unit.prototype.yield = function(output){
    for (var portName in output){
        var wire = this.portBindings[portName];
        wire.send(output[portName]);
    }
}

Bus = function(){}

Bus.prototype.newWire = function(wireName){
    this[wireName] = new Wire();
    this[wireName].connectedUnits = [];
    this[wireName].connectedWires = [];
    this[wireName].connectedProbes = [];
    this[wireName].name = wireName;
    return this[wireName];
}

Wire = function(){}

Wire.prototype.send = function(signal){
    for (var idx in this.connectedUnits){
        var unit = this.connectedUnits[idx].unit;
        var portName = this.connectedUnits[idx].portName;
        if (unit.inputPorts.indexOf(portName) != -1){
            if (unit.pendingInputData.hasOwnProperty(portName))
                console.log("Warning: signal on \"" + this.name + "\" wire that came to port \"" + portName + "\" of Unit \"" + unit.name + "\" was dropped.");
            unit.pendingInputData[portName] = signal;
            if (Object.keys(unit.pendingInputData).length == unit.inputPorts.length){
                var inputs = unit.pendingInputData;
                unit.pendingInputData = {};
                unit.callback.apply(unit, unit.inputPorts.map(function(portName){return inputs[portName]}));
            }
        }
    }
    for (var wire in this.connectedWires){
        if (wire.connectedWires.indexOf(this) == -1)
            wire.send(signal);
    }
    for (var probe in this.connectedProbes){
        this.connectedProbes[probe].bind(this.module)(signal);
    }
}

Wire.prototype.connectWire = function(wire){
    this.connectedWires.push(wire);
}

Wire.prototype.connectProbe = function(callback){
    this.connectedProbes.push(callback);
}