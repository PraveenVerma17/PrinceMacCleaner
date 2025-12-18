const si = require('systeminformation');

async function debug() {
    console.log('--- Memory ---');
    const mem = await si.mem();
    console.log(JSON.stringify(mem, null, 2));

    console.log('--- File System ---');
    const fs = await si.fsSize();
    console.log(JSON.stringify(fs, null, 2));
}

debug();
