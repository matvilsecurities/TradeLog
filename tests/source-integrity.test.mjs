import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const conflictMarker = /^\s*(?:<{7}(?:\s|$)|={7}\s*$|>{7}(?:\s|$)|\|{7}(?:\s|$))/m;

function checkDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const location = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      checkDirectory(new URL(`${entry.name}/`, directory));
    } else if (entry.isFile()) {
      assert.ok(
        !conflictMarker.test(readFileSync(location, "utf8")),
        `Unresolved merge conflict in ${fileURLToPath(location)}`
      );
    }
  }
}

checkDirectory(new URL("../src/", import.meta.url));
console.log("Source merge-conflict guards passed");
