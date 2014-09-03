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
                    dot += "Unit" + srcUnitId + ":" + srcPort + ":e -> Unit" + dstUnitId + ":" + dstPort + ":w [tooltip=\"" + wire.name + "\"" + (wire.hasOwnProperty("holdedValue") ? ",arrowhead=diamond" : "") + "];\n";
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
                        dot += "Unit" + srcUnitId + ":" + srcPort + ":e -> Module" + adjacentModuleId + ":" + adjacentModuleWire.name + "_in:w [tooltip=\"" + wire.name + "\"" + (wire.hasOwnProperty("holdedValue") ? ",arrowhead=diamond" : "") + "];\n";
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
                        dot += "Module" + adjacentModuleId + ":" + adjacentModuleWire.name + "_out:e -> Unit" + dstUnitId + ":" + dstPort + ":w [tooltip=\"" + parentdModuleWire.name + "\"" + (parentdModuleWire.hasOwnProperty("holdedValue") ? ",arrowhead=diamond" : "") + "];\n";
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

Wire.prototype.generateDot = function(callback){
    var index = [];
    var index2 = [];
    var unknowns = 0;

    function printNodes(node){
        var out = "";
        if (node && index.indexOf(node) == -1){
            index.push(node);
            index.push(node.module);
            if (node instanceof Unit){
                var outPorts = Object.keys(node.outputPorts)
                    .map(function(port){return "<" + port + ">" + port})
                    .toString().replace(/,/g, "|");
                var inPorts = Object.keys(node.inputPorts)
                    .map(function(port){return "<" + port + ">" + port})
                    .toString().replace(/,/g, "|");
                out += "\nsubgraph cluster" + index.indexOf(node.module) + "{\n  label=\"" + node.module.name + "\";\n"
                    + "  Unit" + index.indexOf(node) + " [label=\"{{" + inPorts + "}|" + node.name + "|{" + outPorts + "}}\"];\n"
                    + "}\n";
                for (var portName in node.inputPorts){
                    if (node.inputPorts[portName].trace)
                        out += printNodes(node.inputPorts[portName].trace.sender);
                }
            }
            if (node instanceof Wire){
                out += "\nsubgraph cluster" + index.indexOf(node.module) + "{\n  label=\"" + node.module.name + "\";\n"
                    + "  Wire" + index.indexOf(node) + " [label=\"" + node.name + "\" shape=circle];\n}\n";
                if (node.trace)
                    out += printNodes(node.trace.sender);
            }
        }
        return out;
    }

    function printEdges(receiver){
        var out = "";
        if (receiver && index2.indexOf(receiver) == -1){
            index2.push(receiver);
            if (receiver instanceof Unit){
                for (var portName in receiver.inputPorts){
                    var sender = receiver.inputPorts[portName].trace.sender;
                    var wire = receiver.inputPorts[portName];
                    if (sender instanceof Unit){
                        out += "Unit" + index.indexOf(sender) + ":" + Object.keys(sender.outputPorts).filter(function(port){return wire == sender.outputPorts[port]})[0] + ":e -> " + "Unit" + index.indexOf(receiver) + ":" + portName + ":w [tooltip=\"" + wire.name + "\"" + (wire.hasOwnProperty("holdedValue") ? ",arrowhead=diamond" : "") + "];\n";
                    } else if (sender instanceof Wire){
                        out += "Wire" + index.indexOf(sender) + " -> " + "Unit" + index.indexOf(receiver) + ":" + portName + ":w [tooltip=\"" + wire.name + "\"" + (wire.hasOwnProperty("holdedValue") ? ",arrowhead=diamond" : "") + "];\n";
                    } else {
                        out += "Unknown" + unknowns++ + " -> " + "Unit" + index.indexOf(receiver) + ":" + portName + ":w;\n";
                    }
                    out += printEdges(sender);
                }
            } else if (receiver instanceof Wire){
                if (receiver.trace){
                    var sender = receiver.trace.sender;
                    if (sender instanceof Unit){
                        out += "Unit" + index.indexOf(sender) + ":" + Object.keys(sender.outputPorts).filter(function(port){return receiver == sender.outputPorts[port]})[0] + ":e -> " + "Wire" + index.indexOf(receiver) + " [tooltip=\"" + receiver.name + "\"" + (receiver.hasOwnProperty("holdedValue") ? ",arrowhead=diamond" : "") + "];\n";
                    } else if (sender instanceof Wire){
                        out += "Wire" + index.indexOf(sender) + " -> " + "Wire" + index.indexOf(receiver) + " [tooltip=\"" + sender.name + " -> " + receiver.name + "\"" + (receiver.hasOwnProperty("holdedValue") ? ",arrowhead=diamond" : "") + "];\n";
                    } else {
                        out += "Unknown" + unknowns++ + " -> " + "Wire" + index.indexOf(receiver) + " [tooltip=\"" + receiver.name + "\"" + (receiver.hasOwnProperty("holdedValue") ? ",arrowhead=diamond" : "") + "];\n";
                    }
                    out += printEdges(sender);
                }
            }
        }
        return out;
    }

    return  "digraph \"\" {\n"
        + "graph [rankdir = LR, ranksep = 1];\n"
        + "node [shape = record];\n"
        + "edge [penwidth = 1.5];\n"
        + "splines = true;\n"
        + "overlap = false;\n"
        + "nodesep = 0.5;\n"
        + printNodes(this)
        + "\n"
        + printEdges(this)
        + "}\n";
}


Module.prototype.showDiagram = function(){
    window.open("http://gorokh.com/cgi-bin/dot2svg.cgi?" + encodeURI(this.generateDot()));
    /* dot2svg.cgi:
    #!/bin/bash
    echo "Content-Type: image/svg+xml"
    echo
    printf '%b' "${QUERY_STRING//%/\\x}" | /usr/bin/dot -Tsvg
    */    
}

Wire.prototype.showDiagram = Module.prototype.showDiagram;
