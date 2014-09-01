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

Module.prototype.generateDot = function(){
    var module = this;
    var dot = "digraph \"\" {\n"
        + "graph [rankdir = LR, ranksep = 1, label=\"" + module.name + "\"];\n"
        + "node [shape = record];\n"
        + "edge [penwidth = 1.5];\n"
        + "splines = true;\n"
        + "overlap = false;\n"
        + "nodesep = 0.5;\n";
    var units = module.units;
    var outPortsPerUnit = [];
    var adjacentModules = [];
    for (var idx in units){
        var unit = units[idx];
        var outPorts = Object.keys(unit.outputPorts)
            .map(function(port){return "<" + port + ">" + port})
            .toString().replace(/,/g, "|");
        var inPorts = Object.keys(unit.inputPorts)
            .map(function(port){return "<" + port + ">" + port})
            .toString().replace(/,/g, "|");
        dot += "Unit" + idx + " [label=\"{{" + inPorts + "}|" + unit.name + "|{" + outPorts + "}}\"];\n";
        outPortsPerUnit[idx] = Object.keys(unit.outputPorts);
    }
    dot += "\n";

    //dot += "Bus [label=\"{" + module.name + "\\n\\nBus|{" + Object.keys(module.bus).toString().replace(/,/g, "|") + "}}\"];\n";

    for (var idx in module.bus){
        var wire = module.bus[idx];
        if (wire.connectedUnits){
            var dstPorts = wire.connectedUnits.filter(function(port){return outPortsPerUnit[units.indexOf(port.unit)].indexOf(port.portName) == -1});
            var srcPorts = wire.connectedUnits.filter(function(port){return outPortsPerUnit[units.indexOf(port.unit)].indexOf(port.portName) != -1});
            for (var idx2 in srcPorts){
                var srcUnitId = units.indexOf(srcPorts[idx2].unit);
                var srcPort = srcPorts[idx2].portName;
                var storageCell = Object.keys(module.connectedStorage).filter(function(storageCell){return module.connectedStorage[storageCell] == wire});
                if (storageCell.length)
                    dot += "Unit" + srcUnitId + ":" + srcPort + ":e -> Storage:" + storageCell[0] + ":w [tooltip=\"" + wire.name + "\"];\n";
                for (var idx3 in dstPorts){
                    var dstUnitId = units.indexOf(dstPorts[idx3].unit);
                    var dstPort = dstPorts[idx3].portName;
                    dot += "Unit" + srcUnitId + ":" + srcPort + ":e -> Unit" + dstUnitId + ":" + dstPort + ":w [tooltip=\"" + wire.name + "\"" + (wire.hasOwnProperty("holdedValue") ? ",arrowhead=dot" : "") + "];\n";
                }
            }
            if (wire.connectedWires){
                for (var idx2 in wire.connectedWires){
                    var adjacentModuleWire = wire.connectedWires[idx2];
                    var adjacentModule = adjacentModuleWire.module;
                    var adjacentModuleId = module.modules.indexOf(adjacentModule);
                    if (!adjacentModules[adjacentModuleId])
                        adjacentModules[adjacentModuleId] = {"srcPorts": {}, "dstPorts": {}};
                    if (srcPorts.length)
                        adjacentModules[adjacentModuleId].srcPorts[adjacentModuleWire.name] = true;
                    for (var idx3 in srcPorts){
                        var srcUnitId = units.indexOf(srcPorts[idx3].unit);
                        var srcPort = srcPorts[idx3].portName;
                        dot += "Unit" + srcUnitId + ":" + srcPort + ":e -> Module" + adjacentModuleId + ":" + adjacentModuleWire.name + "_in:w [tooltip=\"" + wire.name + "\"" + (wire.hasOwnProperty("holdedValue") ? ",arrowhead=dot" : "") + "];\n";
                    }
                }
            }
        }
    }
    dot += "\n";
    for (var idx in module.modules){
        var adjacentModuleId = idx;
        var adjacentModuleBus = module.modules[idx].bus;
        if (!adjacentModules[adjacentModuleId])
            adjacentModules[adjacentModuleId] = {"srcPorts": {}, "dstPorts": {}};
        for (var idx2 in adjacentModuleBus){
            var adjacentModuleWire = adjacentModuleBus[idx2];
            for (var idx3 in adjacentModuleWire.connectedWires){
                var parentdModuleWire = adjacentModuleWire.connectedWires[idx3];
                if (Object.keys(module.bus).filter(function(wireName){return module.bus[wireName] == parentdModuleWire}).length){
                    var dstPorts = parentdModuleWire.connectedUnits.filter(function(port){return outPortsPerUnit[units.indexOf(port.unit)].indexOf(port.portName) == -1});
                    if (dstPorts.length)
                        adjacentModules[adjacentModuleId].dstPorts[adjacentModuleWire.name] = true;
                    for (var idx4 in dstPorts){
                        var dstUnitId = units.indexOf(dstPorts[idx4].unit);
                        var dstPort = dstPorts[idx4].portName;
                        dot += "Module" + adjacentModuleId + ":" + adjacentModuleWire.name + "_out:e -> Unit" + dstUnitId + ":" + dstPort + ":w [tooltip=\"" + parentdModuleWire.name + "\"" + (parentdModuleWire.hasOwnProperty("holdedValue") ? ",arrowhead=dot" : "") + "];\n";
                    }
                    var storageCell = Object.keys(module.connectedStorage).filter(function(storageCell){return module.connectedStorage[storageCell] == parentdModuleWire});
                    if (storageCell.length)
                        dot += "Module" + adjacentModuleId + ":" + adjacentModuleWire.name + "_out:e -> Storage:" + storageCell[0] + ":w [tooltip=\"" + parentdModuleWire.name + "\"];\n";
                    }
            }
        }
    }
    dot += "\n";
    for (var adjacentModuleId in adjacentModules){
        var srcPorts = Object.keys(adjacentModules[adjacentModuleId].srcPorts)
            .map(function(port){return "<" + port + "_in>" + port})
            .toString().replace(/,/g, "|");
        var dstPorts = Object.keys(adjacentModules[adjacentModuleId].dstPorts)
            .map(function(port){return "<" + port + "_out>" + port})
            .toString().replace(/,/g, "|");
        var adjacentModuleName = module.modules[adjacentModuleId].name;
        dot += "Module" + adjacentModuleId + " [label=\"{{" + srcPorts + "}|" + adjacentModuleName + "|{" + dstPorts + "}}\", style=filled, fillcolor=gainsboro];\n";
    }
    dot += "\n";
    var storageCells = Object.keys(module.connectedStorage);
    if (storageCells.length){
        var inPorts = storageCells
            .map(function(port){return "<" + port + ">" + port})
            .toString().replace(/,/g, "|");
        dot += "Storage [label=\"{{" + inPorts + "}|Storage}\" style=rounded];\n\n";
    }
    dot += "}";
    return dot;
}

Module.prototype.showDiagram = function(){
    window.open("http://gorokh.com/cgi-bin/dot2svg.cgi?" + encodeURI(this.generateDot()));
}


Unit = function(callback, name) {
        return [callback, name];
}

Unit.prototype.connect = function(portWirePairs, mode){
    for (var portName in portWirePairs){
        var wireName = portWirePairs[portName];
        if (this.module.bus[wireName]){
            var wire = this.module.bus[wireName];
            if (wire.hasOwnProperty("holdedValue") ^ (mode == "level"))
                throw Error("Wire " + wire.name + " is already configured as " + (wire.hasOwnProperty("holdedValue") ? "level" : "edge") + " triggered.");
        } else {
            var wire = this.module.bus.newWire(wireName);
            wire.module = this.module;
        }
        wire.connectedUnits.push({
            "unit": this,
            "portName": portName
        });
        if (mode == "level"){
            wire.holdedValue = null;
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

Bus.prototype.newWire = function(wireName){
    this[wireName] = new Wire();
    this[wireName].connectedUnits = [];
    this[wireName].connectedWires = [];
    this[wireName].connectedProbes = [];
    this[wireName].name = wireName;
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
