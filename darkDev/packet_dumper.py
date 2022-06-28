#Version https://github.com/Alph4rd/darkorbit_packet_dumper/commit/f567266670da2410fe376807d19696676652599b
import argparse
import psutil
import frida
import json
import sys
import os
import re
from datetime import datetime

from websocket import create_connection
ws = create_connection("ws://localhost:44569")

avm_script ='''
const packet_sender_id  = 27117;
const packet_handler_id = 27124;
var patterns = { 
    darkbot : "ff ff 01 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 02 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00 00 00 00"
};

function findFlashLib()
{
    return Process.enumerateModules().find(el => {
        return el.name.indexOf("pepflash") >= 0 || el.name.indexOf("Flash.ocx") >= 0
    })
}

var flash_lib = findFlashLib();

// Objects for json stringfy
var as3_ns = null;
var separator_string = null;
var my_json_object = null;
var fake_vtable = null;

// String* stringifySpecializedToString(Atom value, ArrayObject* propertyWhitelist, FunctionObject* replacerFunction, String* gap);
var stringify_f     = null;

// void Toplevel::setproperty(Atom obj, const Multiname* multiname, Atom value, VTable* vtable) 
var setproperty_f   = null;

// Atom Toplevel::getproperty(Atom obj, const Multiname* multiname, VTable* vtable)
var getproperty_f   = null;

// 
var createstring_f = null;

var packet_handler = null;
var packet_sender = null;

// Methods waiting for compilation before being hooked
var hook_queue = [];

var avm = {
    core : null,
    constant_pool : null,
    abc_env : null,
    toplevel : null
};

var offsets = { };

if (Process.platform == "windows") {
    offsets = {
        method_list : 0x148,
        ns_list : 0x188,
        mn_list : 0xc8,
        mn_count : 0x80
    }
    if (flash_lib.name.indexOf("Flash.ocx") >= 0) {
        patterns.stringify          = "48 89 5c 24 08 48 89 6c 24 18 56 57 41 56 48 81 ec d0 00 00 00"
        patterns.verifyjit          = "40 53 55 56 57 41 56 41 57 48 81 ec 18 03 00 00 48 8b 05 ?? ?? ?? ?? 48 33 c4"
        patterns.setproperty        = "48 89 5c 24 08 48 89 6c 24 10 48 89 74 24 18 48 89 7c 24 20 41 56 48 83 ec 30 48 8b 5c 24 60 48 8b ea"
        patterns.getproperty        = "40 53 55 56 57 41 56 48 83 ec 30 48 8b 05 ?? ?? ?? ?? 48 33 c4 48 89 44 24 28 48 8b f2 49 8b f9"
        patterns.createstring       = "40 53 55 57 41 55 41 57 48 83 ec 60 48 8b 05 ?? ?? ?? ?? 48 33 c4 48 89 44 24 40"
        //patterns.newarray           = "48 89 5c 24 08 57 48 83 ec 20 48 8b 41 18 8b da ba 09 00 00 00 49 8b f8 48 8b 48 08"
        offsets.ns_list = 0x180;
    } else {
        patterns.stringify = "40 53 48 81 ec c0 00 00 00 48 8b 84 24 f0 00 00 00 48 8b da 48 8b 51 10 48 89 44 24 28"
        patterns.verifyjit          = "48 89 5c 24 08 48 89 6c 24 10 48 89 74 24 18 57 48 81 ec 00 03 00 00 48 8d 41 30"
        patterns.setproperty = "48 89 5c 24 08 48 89 6c 24 10 48 89 74 24 18 48 89 7c 24 20 41 56 48 83 ec 30 48 8b 5c 24 60 48 8b ea 49 8b f9 49 8b f0 4c 8b f1 48 8b 53 28"
        patterns.getproperty = "48 89 5c 24 08 48 89 6c 24 10 56 57 41 56 48 83 ec 20 48 8b f2 4d 8b f1 49 8b 51 28 49 8b d8"
        patterns.createstring = "40 53 55 57 41 55 41 56 48 83 ec 50 33 ed 45 8b f1 41 8b d8 48 8b fa 4c 8b e9 48 85 d2"
    }


} else if (Process.platform == "linux") {
    patterns.stringify          = "55 48 89 d0 48 89 f5 4d 89 c1 49 89 c8 48 89 c1 53 48 81 ec 98 00 00 00"
    patterns.verifyjit          = "48 89 5c 24 d0 4c 89 64 24 e0 48 89 fb 4c 89 6c 24 e8 4c 89 74 24 f0 49 89 f4 4c 89 7c 24 f8 48 89 6c 24 d8 4d 89 c7 48 81 ec 08 03 00 00"
    patterns.setproperty        = "48 89 5c 24 e0 48 89 6c 24 e8 48 89 d3 4c 89 64 24 f0 4c 89 6c 24 f8 48 83 ec 38 49 89 f5 49 8b 70 28"
    patterns.getproperty        = "48 89 5c 24 d8 48 89 6c 24 e0 48 89 d3 4c 89 64 24 e8 4c 89 6c 24 f0 49 89 f4 4c 89 74 24 f8 48 83 ec 38 48 8b 71 28 48 89 fd 49 89 cd e8 3e 60 fd ff"
    patterns.createstring       = "41 57 41 56 41 55 49 89 fd 41 54 55 89 d5 53 48 89 f3 48 83 ec 68 48 85 f6"

    offsets= {
        method_list : 0x180,
        ns_list : 0x190,
        mn_list : 0xe8,
        mn_count : 0x98
    };
} else {
    console.log("[!] Os not supported");
}


const TRAIT_Slot          = 0x00;
const TRAIT_Method        = 0x01;
const TRAIT_Getter        = 0x02;
const TRAIT_Setter        = 0x03;
const TRAIT_Class         = 0x04;
const TRAIT_Const         = 0x06;
const TRAIT_COUNT         = TRAIT_Const+1;
const TRAIT_mask          = 15;
function getObjectTraits(object_ptr) {
    var traits = object_ptr.add(0x10).readPointer().add(0x28).readPointer();

    var traits_pos = traits.add(0xb0).readPointer();
    var pos_type   = traits.add(0xf5).readU8();

    if (pos_type != 0)
        return;

    var tdata = new CoolPtr(traits_pos);

    var qname = tdata.ReadU32();
    var sname = tdata.ReadU32();

    var flags = tdata.ReadU8();

    if ((flags & 8) != 0)
        tdata.ReadU32();

    // Skip
    var interface_count = tdata.ReadU32();
    for (var i = 0; i < interface_count; i++)
        tdata.ReadU32();

    // Skip iinit
    tdata.ReadU32();

    var trait_count = tdata.ReadU32();

    var traits = [];

    for (var i = 0; i < trait_count; i++) {
        var name = tdata.ReadU32();
        var tag = tdata.ReadU8();

        var kind = tag & 0xf;

        switch (kind) {
            case TRAIT_Slot:
            case TRAIT_Const:
                var slot_id    = tdata.ReadU32();
                var type_name  = tdata.ReadU32();
                // references one of the tables in the constant pool, depending on the value of vkind
                var vindex     = tdata.ReadU32(); 
                if (vindex)
                    tdata.ReadU8(); // vkind, ignored by the avm

                traits.push({name : name, kind : kind, type : type_name});
                break;
            case TRAIT_Class:
                var slot_id     = tdata.ReadU32();
                //  is an index that points into the class array of the abcFile entry
                var class_index = tdata.ReadU32(); 
                traits.push({name : name, kind : kind, index : class_index});
                break;
            case TRAIT_Method:
            case TRAIT_Getter:
            case TRAIT_Setter:
            {
                var disp_id         = tdata.ReadU32();
                // is an index that points into the method array of the abcFile e
                var method_index    = tdata.ReadU32(); 
                traits.push({name : name, kind : kind, method : method_index});
                break;
            }
            default:
        }

        if (tag & 0x40) {
            var metadata_count = tdata.ReadU32();
            for (var i = 0; i < metadata_count; i++) {
                var index = tdata.ReadU32();
            }
        }
    }

    return traits;
}

function getPropertyTrait(obj_ptr, prop_name) {
    // Could also call TopLevel::haspropety 
    return getObjectTraits(obj_ptr).find(t => {
        var multiname = getMultiname(t.name);
        return multiname && !multiname.equals(0) && readAvmString(multiname.readPointer()) == prop_name;
    });
}

function setObjectProperty(obj_ptr, name, value) {
    var prop_trait = getPropertyTrait(obj_ptr, name);

    if (!prop_trait) {
        console.log("setObjectProperty: property not found");
        return null;
    }

    var trait_mn = getMultiname(prop_trait.name);
    var vtable =  obj_ptr.add(0x10).readPointer();

    setproperty_f(avm.toplevel, obj_ptr.or(1), trait_mn, value, vtable);
}

function getObjectProperty(obj_ptr, name) {
    var prop_trait = getPropertyTrait(obj_ptr, name);

    if (!prop_trait)
        return ptr(0);

    var trait_mn = getMultiname(prop_trait.name);
    var vtable =  obj_ptr.add(0x10).readPointer();

    return getproperty_f(avm.toplevel, obj_ptr.or(1), trait_mn, vtable);
}

// Used for parsing abc data
class CoolPtr {
    constructor(pointer) {
        this.ptr = pointer;
    }

    ReadU8() { 
        var r = this.ptr.readU8();
        this.ptr = this.ptr.add(1);
        return r;
    }

    ReadU32() {
        var data = new Uint8Array(this.ptr.readByteArray(5 * 4));
        var result = data[0];
        if (!(result & 0x00000080)) {
            this.ptr = this.ptr.add(1);
            return result;
        }
        result = (result & 0x0000007f) | data[1]<<7;
        if (!(result & 0x00004000)) {
            this.ptr = this.ptr.add(2);
            return result;
        }
        result = (result & 0x00003fff) | data[2]<<14;
        if (!(result & 0x00200000)) {
            this.ptr = this.ptr.add(3);
            return result;
        }
        result = (result & 0x001fffff) | data[3]<<21;
        if (!(result & 0x10000000)) {
            this.ptr = this.ptr.add(4);
            return result;
        }
        result = (result & 0x0fffffff) | data[4]<<28;
        this.ptr = this.ptr.add(5);
        return result;
    }
}

function findPattern(pattern, match_handler) {
    var ranges = Process.enumerateRangesSync({protection: 'r--', coalesce: true});
    var stop = false;

    for (var range of ranges) {
        Memory.scan(range.base, range.size, pattern, {
            onMatch: match_handler,
            onError: function(reason){ },
            onComplete: function() { }
        });
    }
}

function getMultiname(index) {
    var precomp_mn      = avm.constant_pool.add(offsets.mn_list).readPointer();
    var precomp_mn_size = avm.constant_pool.add(offsets.mn_count).readU32();
    if (index < precomp_mn_size)
        return precomp_mn.add(0x18 + index * 0x18);
    return null;
}

function getObjectSize(object_ptr) {
    var gc_block_header = object_ptr.and((new NativePointer(4095)).not());
    return gc_block_header.add(0x4).readU32();
}

function removeKind(pointer) {
    return pointer.and(uint64(0x7).not());
}

function readAvmString(str_pointer, c=0) {
    str_pointer = removeKind(str_pointer); 
    if (str_pointer.equals(0))
        return "";
    
    var flags = str_pointer.add(0x24).readU32();
    var size  = str_pointer.add(0x20).readU32();

    var width = (flags & 0x1);
    size <<= width;

    if (size < 0 || c > 1) 
        return "";
    
    // 
    if ((flags & (2 << 1)) != 0)
        return readAvmString(removeKind(str_pointer.add(0x18).readPointer()), c+1);

    var str_addr = str_pointer.add(0x10).readPointer();

    if (width)
        return str_addr.readUtf16String(size);
    return str_addr.readCString(size);
}

function getMethodName(method_info) {
    var name_list = avm.constant_pool.add(0x190).readPointer();
    var method_id = method_info.add(0x40).readU32();

    var name_index = name_list.add(4 + method_id * 4).readInt();

    if (name_index < 0) {
        name_index = -name_index;
        var multiname = getMultiname(name_index);
        if (multiname != 0) {
            //console.log(multiname.add(0x8).readPointer());
            return readAvmString(multiname.readPointer());
        }

        return "";
    } else {
        // TODO: handle non negative names
    }
    return "";
}

function methodIsCompiled(method_info_ptr) {
    return ((method_info_ptr.add(0x60).readU32() >> 21) & 1) == 1;
}

function getPacketIdFromObj(packet_obj) {
    packet_obj = removeKind(packet_obj);
    var vtable = packet_obj.add(0x10).readPointer();

    // Hopefully the method index doesn't change
    var get_id_method_env = vtable.add(0x78 + 3 * 8).readPointer()
    if (get_id_method_env != 0) {
        var method_info = get_id_method_env.add(0x10).readPointer();
        var method_id   = method_info.add(0x40).readU32();
        var method_code = method_info.add(0x8).readPointer();

        var get_id_f = new NativeFunction(method_code, 'int64', ['pointer', 'uint64', 'pointer']);

        var get_id_args = Memory.alloc(0x10)
        get_id_args.writePointer(packet_obj);
        get_id_args.add(0x8).writeU64(0);

        return get_id_f(get_id_method_env, 1, get_id_args);
    }

    return null;
}

function getClassName(script_obj) {
    script_obj = removeKind(script_obj);
    var vtable = script_obj.add(0x10).readPointer();
    var traits = vtable.add(0x28).readPointer();
    var name_str = traits.add(0x90).readPointer();
    return readAvmString(name_str);
}

function packetToString(packet_obj) {
    if (stringify_f && my_json_object && separator_string)
        return readAvmString(stringify_f(my_json_object, packet_obj.add(1), ptr(0), ptr(0), separator_string ));

    return null;
}

// arg0 == method_env
// arg1 == avm arg_count
// arg2 == avm argv
function onPacketRecv(args) {
    var arg_count = args[1];
    var flash_args = ptr(args[2]);
    var packet_obj = removeKind(flash_args.add(8).readPointer());

    var packet_id = getPacketIdFromObj(packet_obj);
    var str_packet = packetToString(packet_obj);

    if (packet_id && str_packet)
        send({"type":0, "id":packet_id, "name":getClassName(packet_obj), "packet": JSON.parse(str_packet)});
};

function onPacketSend(args) {
    var arg_count = args[1];
    var flash_args = ptr(args[2]);
    var packet_obj = removeKind(flash_args.add(8).readPointer());

    var packet_id = getPacketIdFromObj(packet_obj);
    var str_packet = packetToString(packet_obj);

    if (packet_id && str_packet)
        send({"type":1, "id":packet_id, "name":getClassName(packet_obj), "packet": JSON.parse(str_packet)});
};

function createAvmString(str) {
    var string_buf = Memory.allocUtf8String(str);
    return createstring_f(avm.core, string_buf, -1, 0, 0, 0);
}

function jsValueToAtom(value) {
    if (typeof(value) == "number"){ 
        return ptr(value << 3).or(6);
    } else if (typeof(value) == "string") {
        return createAvmString(value).or(2);
    } else if (typeof(value) == "boolean") {
        return ptr((+ value) << 3).or(5);
    }
}

// TODO: support onLeave
function hookLater(method_ptr, callback) {
    hook_queue.push({method:method_ptr, handler:callback});
}

var previous_hooks = [];
Memory.scan(flash_lib.base, flash_lib.size, patterns.verifyjit, {
    onMatch : function(addr, size) {
        console.log("[+] Found verifyJit:", ptr(addr));

        Interceptor.attach(ptr(addr), {
            onEnter: function(args) { 
                this.method = ptr(args[1]);
                if (previous_hooks.length) {  
                    // On windows, the avm will crash if the permissions of the code page aren't
                    // RX, so in case the current code gets allocated in the same page as the code
                    // we hooked, we need to reset permissions.
                    previous_hooks.forEach(hk => {
                        var hk_page = hk.and(uint64(4096-1).not());
                        Memory.protect(hk_page, 4096, "r-x");
                    });
                }
            },
            onLeave: function(retval) {
                var hindex = hook_queue.findIndex(h => h.method.equals(this.method));
                if (hindex >= 0) {
                    var hook = hook_queue[hindex];
                    var code = this.method.add(0x8).readPointer();
                    previous_hooks.push(code);
                    Interceptor.attach(code, { onEnter: hook.handler });
                    hook_queue.splice(hindex, 1);
                }
            }
        });
    },
    onError: function(reason){ },
    onComplete: function() { }
});

Memory.scan(flash_lib.base, flash_lib.size, patterns.stringify, {
    onMatch : function(addr, size) {
        if (!stringify_f) {
            console.log("[+] Json stringify     :", ptr(addr));
            stringify_f = new NativeFunction(ptr(addr), 'pointer', ['pointer', 'pointer', 'pointer', 'pointer', 'pointer']);
        }
    },
    onError: function(reason){ },
    onComplete: function() { }
});

Memory.scan(flash_lib.base, flash_lib.size, patterns.createstring, {
    onMatch : function(addr, size) {
        if (!createstring_f) {
            console.log("[+] CreateString  :", ptr(addr));
            createstring_f = new NativeFunction(ptr(addr), 'pointer', ['pointer', 'pointer', 'int', 'int', 'bool','bool']);
        }
    },
    onError: function(reason){ },
    onComplete: function() { }
});

Memory.scan(flash_lib.base, flash_lib.size, patterns.setproperty, {
    onMatch : function(addr, size) {
        if (!setproperty_f) {
            console.log("[+] setproperty     :", ptr(addr));
            setproperty_f = new NativeFunction(ptr(addr), 'void', ['pointer', 'pointer', 'pointer', 'pointer', 'pointer']);
        }
    },
    onError: function(reason){ },
    onComplete: function() { }
});

Memory.scan(flash_lib.base, flash_lib.size, patterns.getproperty, {
    onMatch : function(addr, size) {
        if (!getproperty_f) {
            console.log("[+] getproperty     :", ptr(addr));
            getproperty_f = new NativeFunction(ptr(addr), 'pointer', ['pointer', 'pointer', 'pointer', 'pointer']);
        }
    },
    onError: function(reason){ },
    onComplete: function() { }
});

findPattern(patterns.darkbot, function(addr, size) {
    addr -= 226;
    if (as3_ns)
        return;
    var main_address    = ptr(addr + 0x540).readPointer();
    var vtable          = main_address.add(0x10).readPointer();
    var traits          = vtable.add(0x28).readPointer();
    avm.toplevel        = vtable.add(0x8).readPointer();
    var vtable_init     = vtable.add(0x10).readPointer();
    var vtable_scope    = vtable_init.add(0x18).readPointer();
    avm.abc_env         = vtable_scope.add(0x10).readPointer();
    avm.core            = traits.add(0x8).readPointer();
    avm.constant_pool   = avm.abc_env.add(0x8).readPointer();

    var method_list      = avm.constant_pool.add(offsets.method_list).readPointer();
    var ns_list          = avm.core.add(offsets.ns_list).readPointer();
    var ns_count         = avm.core.add(0x80).readPointer();

    // ids are not reliable, might change after an update
    packet_handler = method_list.add(0x10 + packet_handler_id * 8).readPointer();
    packet_sender  = method_list.add(0x10 + packet_sender_id  * 8).readPointer();

    // Iterate namespaces
    for (var i = 0, c = 0; i < 0x40000 && c < ns_count; i++) {
        var namespace = ns_list.add(i * 8).readPointer();
        if (namespace == 0)
            continue;

        try { var namespace_str = namespace.add(0x18).readPointer(); }
        catch { break; }

        var s = readAvmString(namespace_str, 0);

        // Find as3 namespace
        if (s && s == "http://adobe.com/AS3/2006/builtin" && !as3_ns) {
            as3_ns = namespace;
            // Remove AtomKind bits
            var namespace_str = removeKind(namespace.add(0x18).readPointer());
            separator_string = Memory.dup(namespace_str, 0x28);
            separator_string.add(0x20).writeU64(0x0);

            my_json_object = Memory.alloc(0x38);
            my_json_object.add(0x30).writePointer(as3_ns);

            fake_vtable = Memory.alloc(0x38);
            fake_vtable.add(8).writePointer(avm.toplevel);
            my_json_object.add(0x10).writePointer(fake_vtable);
            console.log("[+] Fake json object   :", my_json_object);
            break;
        }
        c++;
    }

    console.log("[+] Main address       :", main_address);
    console.log("[+] ConstPool address  :", avm.constant_pool);
    console.log("[+] AvmCore address    :", avm.core);
    console.log("[+] Namespace list     :", ns_list);
    console.log("[+] Packet handler     :", packet_handler.add(0x8));
    console.log("[+] Packet sender      :", packet_sender.add(0x8));

    send({"type": -1, "Main": main_address, "ConstPool": avm.constant_pool, "AvmCore": avm.core, "Namespace_list": ns_list, "Packet_handler": packet_handler.add(0x8), "Packet_sender": packet_sender.add(0x8)});

    // Hook methods, or wait for them to be jit compiled before hooking
    if (!methodIsCompiled(packet_handler)) {
        console.log("[+] Packet receiver is not compiled, waiting for it");
        hookLater(packet_handler, onPacketRecv);
    } else {
        Interceptor.attach(packet_handler.add(0x8).readPointer(), { onEnter: onPacketRecv });
    }

    if (!methodIsCompiled(packet_sender)) {
        console.log("[+] Packet sender is not compiled, waiting for it");
        hookLater(packet_sender, onPacketSend);
    } else {
        Interceptor.attach(packet_sender.add(0x8).readPointer(), { onEnter: onPacketSend });
    }
});
'''
blacklist = []
output_file = None
output_json = False
#IN_PACKET = 0
#OUT_PACKET = 1

def find_flash_process():
    for proc in psutil.process_iter(["pid", "ppid", "cmdline"]):
        try:
            flash_lib = next(filter(lambda m: m.path.find("Flash.ocx") >= 0, proc.memory_maps()))
        except:
            flash_lib = None
        if flash_lib != None or (proc.info["cmdline"] and "--type=ppapi" in proc.info["cmdline"]):
            return(proc.info["pid"])
    return None


def write_output(packet_type, packet_id, name, payload):
    global output_json, output_file

    output = ""
    current_t = datetime.now().isoformat()

    output = json.dumps({ "type" : packet_type, "time" : current_t, "id": packet_id, "name" : name, "data" : payload })

    ws.send(output)

def on_message(msg, data):
    if msg["type"] == "send":
        payload = msg["payload"]
        try:
            blacklist.index(int(payload["id"]))
            return
        except:
            pass
        if payload["type"] == -1:
            ws.send(json.dumps(payload))
        else:
            write_output(payload["type"], int(payload["id"]), payload["name"], payload["packet"])

    elif msg["type"] == "error":
        ws.send(json.dumps(msg, indent=4))
    else:
        print(msg)


#def on_message(msg, data):
#    if msg["type"] == "send":
#        payload = msg["payload"]
#        try:
#            blacklist.index(int(payload["id"]))
#            return
#        except:
#            pass
#        packet = {}
#        if payload["type"] == -1:
#            ws.send(json.dumps(payload))
#        else:
#            packet = {}
#            packet['type'] = payload["type"]
#            packet['packet_name'] = payload["id"]
#            packet['packet_id'] = payload["name"]
#            packet['data'] = payload["packet"]
#        
#        ws.send(json.dumps(packet))
#    elif msg["type"] == "error":
#        packet = {}
#        packet['type'] = -99
#        msg["lineNumber"] -= preamble.count("\n")
#        packet['data'] = msg
#    else:
#        print(msg)

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('-l', '--log', dest="log_file", nargs="?", const=(datetime.now().strftime("%Y-%m-%d_%H-%M-%S.log")), type=str, help="Output file")
    parser.add_argument('-j', '--json', dest="json", action="store_true", required=False, help="Json ouput.")

    return parser.parse_args()

def main():
    global output_file, output_json
    args = parse_args()

    if args.log_file != None:
        print(args.log_file)
        output_file = open(args.log_file, "w")
    output_json = args.json == True

    pid = find_flash_process()

    if not pid:
        print("[!] Failed to find process.")
        return

    print(f"[+] Found process {pid}.")

    try:
        session = frida.attach(pid)
    except frida.ProcessNotRespondingError as e:
        print(e)
        print("Try launching the chromium process with --no-sandbox")
        sys.exit(-1)

    script = session.create_script(avm_script)

    script.on('message', on_message)

    script.load()

    input()

    session.detach()

if __name__ == "__main__":
    main()