Module = function(arg1, arg2) {
    if (this instanceof Module) {
        this.bus = new Bus();
        this.modules = [];
        this.units = [];
        this.connectedStorage = {};
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
    module.modules = [this];
    module.units = [];
    module.connectedStorage = {};
    if (arguments.length == 2) {
        module.name = arg2;
        arg1.bind(module)();
    } else {
        module.name = arg1[1];
        arg1[0].bind(module)();
    }
    this.modules.push(module);
    return module;
}

Module.prototype.connect = function(wires, direction){
    for (var wireName in wires) {
        var wire1 = this.parentModule.bus[wires[wireName]];
        var wire2 = this.bus[wireName];
        if (!wire1)
            throw new Error("Module \"" + this.parentModule.name + "\" does not have \"" + wires[wireName] + "\" wire.");
        if (!wire2)
            throw new Error("Module \"" + this.name + "\" does not have \"" + wireName + "\" wire.");
        if (wire1.hasOwnProperty("holdedValue") ^ wire2.hasOwnProperty("holdedValue"))
            throw new Error("Wire \"" + this.parentModule.name + "\"::\""+ wire1.name + "\" is " + (wire1.hasOwnProperty("holdedValue") ? "level" : "edge") + " triggered, whereas " +
                "wire \"" + this.name + "\"::\"" + wire2.name + "\" is " + (wire2.hasOwnProperty("holdedValue") ? "level" : "edge") + " triggered.");
        switch (direction){
            case "in":
                if (wire1.connectedWires.indexOf(wire2) != -1)
                    throw new Error("Wire \"" + this.parentModule.name + "\"::\"" + wire1.name + "\" is already conected to \"" + this.name + "\"::\"" + wire2.name + "\" wire.");
                wire1.connectWire(wire2);
                break;
            case "out":
                if (wire2.connectedWires.indexOf(wire1) != -1)
                    throw new Error("Wire \"" + this.name + "\"::\"" + wire2.name + "\" is already conected to \"" + this.parentModule.name + "\"::\"" + wire1.name + "\" wire.");
                wire2.connectWire(wire1);
                break;
            case "bidir":
            default:
                if (wire1.connectedWires.indexOf(wire2) != -1)
                    throw new Error("Wire \"" + this.parentModule.name + "\"::\"" + wire1.name + "\" is already conected to \"" + this.name + "\"::\"" + wire2.name + "\" wire.");
                if (wire2.connectedWires.indexOf(wire1) != -1)
                    throw new Error("Wire \"" + this.name + "\"::\"" + wire2.name + "\" is already conected to \"" + this.parentModule.name + "\"::\"" + wire1.name + "\" wire.");
                wire1.connectWire(wire2);
                wire2.connectWire(wire1);
                break;
        }
    }
    return this;
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
    unit.outputPorts = {};
    unit.inputPorts = {};
    unit.callback.toString().match(/function.*\(([\w,\s]*)\)/)[1].split(/\s*,\s*/).forEach(function(portName){
        unit.inputPorts[portName] = null;
    });
    unit.pendingInputData = {};
    unit.module = this;
    this.units.push(unit);
    return unit;
}

Module.prototype.Storage = function(data){
    this.storage = {};
    for (var storageMethod in data){
        for (var wireName in data[storageMethod]){
            if (!this.bus[wireName]){
                this.bus[wireName] = this.bus.newWire(wireName);
                this.bus[wireName].module = this;
            }
            var storageCell = data[storageMethod][wireName];
            this.connectedStorage[storageCell] = this.bus[wireName];
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
    var isLevelModeFlg = Array.prototype.slice.call(arguments, 1).indexOf("level") != -1;
    var isBidirModeFlg = Array.prototype.slice.call(arguments, 1).indexOf("bidir") != -1;
    for (var portName in portWirePairs){
        var wireName = portWirePairs[portName];
        if (this.module.bus[wireName]){
            var wire = this.module.bus[wireName];
            if (wire.hasOwnProperty("holdedValue") ^ isLevelModeFlg)
                throw Error("Wire " + wire.name + " is already configured as " + (wire.hasOwnProperty("holdedValue") ? "level" : "edge") + " triggered.");
        } else {
            var wire = this.module.bus.newWire(wireName, isLevelModeFlg);
            wire.module = this.module;
        }
        wire.connectedUnits.push({
            "unit": this,
            "portName": portName
        });
        if (isBidirModeFlg){
            if (this.inputPorts.hasOwnProperty(portName)){
                this.inputPorts[portName] = wire;
                this.outputPorts[portName] = wire;
            } else throw Error("Cannot connect bidirectional wire to an unit without required input port: \"" + portName + "\".");
        }
        if (this.inputPorts.hasOwnProperty(portName))
            this.inputPorts[portName] = wire;
        else
            this.outputPorts[portName] = wire;
    }
    return this;
}

Unit.prototype.yield = function(output){
    for (var portName in output){
        var wire = this.outputPorts[portName];
        wire.send(output[portName], this);
    }
}

Bus = function(){}

Bus.prototype.newWire = function(wireName, isLevelModeFlg){
    this[wireName] = new Wire();
    this[wireName].connectedUnits = [];
    this[wireName].connectedWires = [];
    this[wireName].connectedProbes = [];
    this[wireName].name = wireName;
    if (isLevelModeFlg){
        this[wireName].holdedValue = null;
    }
    return this[wireName];
}

Wire = function(){}

Wire.prototype.clear = function(){
    this.holdedValue = null;
}

Wire.prototype.send = function(signal, sender){
    this.trace = {
        "sender": sender,
        "signal": signal
    };
    this._sendToProbes(signal);
    this._sendToUnits(signal);
    this._sendToWires(signal);
}

Wire.prototype._sendToUnits = function(signal){
    if (this.hasOwnProperty("holdedValue")){
        var oldHoldedValue = this.holdedValue;
        this.holdedValue = signal;
    }
    if (oldHoldedValue == null){
        for (var idx in this.connectedUnits){
            var unit = this.connectedUnits[idx].unit;
            var portName = this.connectedUnits[idx].portName;
            if (unit.inputPorts.hasOwnProperty(portName)){
                if (unit.pendingInputData.hasOwnProperty(portName)){
                    var err = new Error("Out of sync: signal on \"" + this.name + "\" wire that came to port \"" + portName + "\" of Unit \"" + unit.name + "\" was overwritten by another one.");
                    err.unit = unit;
                    err.wire = this;
                    throw(err);
                }
                var inputs = unit.pendingInputData;
                for (var bindedPortName in unit.inputPorts)
                    if (unit.inputPorts[bindedPortName].holdedValue != null)
                        inputs[bindedPortName] = unit.inputPorts[bindedPortName].holdedValue;
                unit.pendingInputData[portName] = signal;
                if (Object.keys(inputs).length >= Object.keys(unit.inputPorts).length){
                    unit.pendingInputData = {};
                    try{
                        unit.callback.apply(unit, Object.keys(unit.inputPorts).map(function(portName){return inputs[portName]}));
                    }
                    catch(err){
                        err.message = "Unit \"" + unit.name + "\" threw an exeption: " + err.message;
                        err.unit = unit;
                        throw(err);
                    }
                }
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
        this.connectedWires[wire]._sendToProbes(signal);
        this.connectedWires[wire]._sendToUnits(signal);
    }
}

Wire.prototype._sendToProbes = function(signal){
    for (var probe in this.connectedProbes){
        this.connectedProbes[probe].bind(this)(signal);
    }
}

Wire.prototype.connectWire = function(wire){
    this.connectedWires.push(wire);
}

Wire.prototype.connectProbe = function(callback){
    this.connectedProbes.push(callback);
}
