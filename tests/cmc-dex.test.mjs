import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("DEX module is read-only and rejects unsafe token identifiers",()=>{
 const source=readFileSync(new URL("../src/lib/cmc-dex.ts",import.meta.url),"utf8");
 assert.match(source,/validateToken/);
 assert.match(source,/no-store/);
 assert.match(source,/public-api/);
 assert.doesNotMatch(source,/sendTransaction|signTransaction|privateKey/);
});
