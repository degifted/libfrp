Module = function(arg1, arg2) {
    if (this instanceof Module) {
        this.bus = new Bus();
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
    module.parentModule = this;
    module.bus = new Bus();
    if (arguments.length == 2) {
        module.name = arg2;
        arg1.bind(module)();
    } else {
        module.name = arg1[1];
        arg1[0].bind(module)();
    }
    return module;
}

Module.prototype.connect = function(wires){
    for (var wireName in wires) {
        this.parentModule.bus[wires[wireName]].connectWire(this.bus[wireName]);
        this.bus[wireName].connectWire(this.parentModule.bus[wires[wireName]]);
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
    this.storage = {};
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
        wire.send(output[portName], this);
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

Wire.prototype.send = function(signal, sender){
    this.trace = {
        "sender": sender,
        "signal": signal
    };
    this._sendToUnits(signal);
    this._sendToWires(signal);
    this._sendToProbes(signal);
}

Wire.prototype._sendToUnits = function(signal){
    for (var idx in this.connectedUnits){
        var unit = this.connectedUnits[idx].unit;
        var portName = this.connectedUnits[idx].portName;
        if (unit.inputPorts.indexOf(portName) != -1){
            if (unit.pendingInputData.hasOwnProperty(portName))
                console.log("Warning: signal on \"" + this.name + "\" wire that came to port \"" + portName + "\" of Unit \"" + unit.name + "\" was overwritten by another one.");
            unit.pendingInputData[portName] = signal;
            if (Object.keys(unit.pendingInputData).length == unit.inputPorts.length){
                var inputs = unit.pendingInputData;
                unit.pendingInputData = {};
                unit.callback.apply(unit, unit.inputPorts.map(function(portName){return inputs[portName]}));
            }
        }
    }
}

Wire.prototype._sendToWires = function(signal){
    for (var wire in this.connectedWires){
        this.connectedWires[wire].trace = {
            "sender": this,
            "signal": signal
        };
        this.connectedWires[wire]._sendToUnits(signal);
        this.connectedWires[wire]._sendToProbes(signal);
    }
}

Wire.prototype._sendToProbes = function(signal){
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
