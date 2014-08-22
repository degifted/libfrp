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
    module.modules = [];
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

Module.prototype.connect = function(wires){
    for (var wireName in wires) {
        var wire1 = this.parentModule.bus[wires[wireName]];
        var wire2 = this.bus[wireName];
        if (!wire1)
            throw "Module \"" + this.parentModule.name + "\" does not have \"" + wires[wireName] + "\" wire.";
        if (!wire2)
            throw "Module \"" + this.name + "\" does not have \"" + wireName + "\" wire.";
        wire1.connectWire(wire2);
        wire2.connectWire(wire1);
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
    var dot = "digraph G {\n"
        + "graph [concentrate=true,rankdir = LR,overlap = false,splines = true];\n"
        + "node[shape=record];\n\n";

        var module = this;
        var units = module.units;
        var outPortsPerUnit = [];
        var childModules = [];
        for (var idx in units){
            var unit = units[idx];
            var outPorts = Object.keys(unit.portBindings)
                .filter(function(port){return unit.inputPorts.indexOf(port) == -1;})
                .map(function(port){return "<" + port + ">" + port})
                .toString().replace(/,/g, "|");
            var inPorts = Object.keys(unit.portBindings)
                .filter(function(port){return unit.inputPorts.indexOf(port) != -1;})
                .map(function(port){return "<" + port + ">" + port})
                .toString().replace(/,/g, "|");
            dot += "Unit" + idx + " [label=\"{ {" + inPorts + "}|" + unit.name + "|{" + outPorts + "}}\"];\n";
            outPortsPerUnit[idx] = Object.keys(unit.portBindings)
                .filter(function(port){return unit.inputPorts.indexOf(port) == -1;});
        }
        dot += "\n";

        for (var idx in module.bus){
            var wire = module.bus[idx];
            if (wire.connectedUnits){
                var dstPorts = wire.connectedUnits.filter(function(port){return outPortsPerUnit[units.indexOf(port.unit)].indexOf(port.portName) == -1});
                var srcPorts = wire.connectedUnits.filter(function(port){return outPortsPerUnit[units.indexOf(port.unit)].indexOf(port.portName) != -1});
                for (var idx2 in srcPorts){
                    for (var idx3 in dstPorts){
                        var srcUnitId = units.indexOf(srcPorts[idx2].unit);
                        var srcPort = srcPorts[idx2].portName;
                        var dstUnitId = units.indexOf(dstPorts[idx3].unit);
                        var dstPort = dstPorts[idx3].portName;
                        dot += "Unit" + srcUnitId + ":" + srcPort + " -> Unit" + dstUnitId + ":" + dstPort + " [label=\"" + wire.name + "\"];\n";
                    }
                }
                if (wire.connectedWires){
                    for (var idx2 in wire.connectedWires){
                        var childModuleWire = wire.connectedWires[idx2];
                        var childModule = childModuleWire.module;
                        var childModuleId = module.modules.indexOf(childModule);
                        if (!childModules[childModuleId])
                            childModules[childModuleId] = {"srcPorts": {}, "dstPorts": {}};
                        if (srcPorts.length)
                            childModules[childModuleId].srcPorts[childModuleWire.name] = true;
                        for (var idx3 in srcPorts){
                            var srcUnitId = units.indexOf(srcPorts[idx3].unit);
                            var srcPort = srcPorts[idx3].portName;
                            dot += "Unit" + srcUnitId + ":" + srcPort + " -> Module" + childModuleId + ":" + childModuleWire.name + "_in [label=\"" + wire.name + "\"];\n";
                        }
                    }
                }
            }
        }
        dot += "\n";
        for (var idx in module.modules){
            var childModuleBus = module.modules[idx].bus;
            if (!childModules[childModuleId])
                childModules[childModuleId] = {"srcPorts": {}, "dstPorts": {}};
            for (var idx2 in childModuleBus){
                var childModuleWire = childModuleBus[idx2];
                for (var idx3 in childModuleWire.connectedWires){
                    var parentdModuleWire = childModuleWire.connectedWires[idx3];
                    if (Object.keys(module.bus).filter(function(wireName){return module.bus[wireName] == parentdModuleWire}).length){
                        var dstPorts = parentdModuleWire.connectedUnits.filter(function(port){return outPortsPerUnit[units.indexOf(port.unit)].indexOf(port.portName) == -1});
                        if (dstPorts.length)
                            childModules[childModuleId].dstPorts[childModuleWire.name] = true;
                        for (var idx4 in dstPorts){
                            var dstUnitId = units.indexOf(dstPorts[idx4].unit);
                            var dstPort = dstPorts[idx4].portName;
                            dot += "Module" + childModuleId + ":" + childModuleWire.name + "_out -> Unit" + dstUnitId + ":" + dstPort + " [label=\"" + parentdModuleWire.name + "\"];\n";
                        }
                    }
                }
            }
        }
        dot += "\n";
        for (var childModuleId in childModules){
            var srcPorts = Object.keys(childModules[childModuleId].srcPorts)
                .map(function(port){return "<" + port + "_in>" + port})
                .toString().replace(/,/g, "|");
            var dstPorts = Object.keys(childModules[childModuleId].dstPorts)
                .map(function(port){return "<" + port + "_out>" + port})
                .toString().replace(/,/g, "|");
            var childModuleName = module.modules[childModuleId].name;
            dot += "Module" + childModuleId + " [label=\"{ {" + srcPorts + "}|" + childModuleName + "|{" + dstPorts + "}}\"];\n";
        }
        dot += "\n";
        var storageCells = Object.keys(module.connectedStorage);
        if (storageCells.length){
            var inPorts = storageCells
                .map(function(port){return "<" + port + ">" + port})
                .toString().replace(/,/g, "|");
            dot += "Storage [label=\"{ {" + inPorts + "}|Storage|{}}\"];\n\n";
            for (var idx in storageCells){
                var wire = module.connectedStorage[storageCells[idx]];
                var srcPorts = wire.connectedUnits.filter(function(port){return outPortsPerUnit[units.indexOf(port.unit)].indexOf(port.portName) != -1});
                for (var idx2 in srcPorts){
                        var srcUnitId = units.indexOf(srcPorts[idx2].unit);
                        var srcPort = srcPorts[idx2].portName;
                        dot += "Unit" + srcUnitId + ":" + srcPort + " -> Storage:" + storageCells[idx] + " [label=\"" + wire.name + "\"];\n";
                }
            }
        }

    dot += "}";
    return dot;
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
            wire.module = this.module;
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
    this._sendToProbes(signal);
    this._sendToUnits(signal);
    this._sendToWires(signal);
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
