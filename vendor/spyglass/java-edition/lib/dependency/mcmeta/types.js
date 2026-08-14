import * as core from '@spyglassmc/core';
export var McmetaVersion;
(function (McmetaVersion) {
    function check(val) {
        if (!core.isObject(val)) {
            return 'not an object';
        }
        if (!('id' in val && typeof val.id === 'string')) {
            return 'id is not a string';
        }
        if (!('name' in val && typeof val.name === 'string')) {
            return 'name is not a string';
        }
        if (!('type' in val && (val.type === 'release' || val.type === 'snapshot'))) {
            return "type is not 'release' or 'snapshot'";
        }
        if (!('stable' in val && typeof val.stable === 'boolean')) {
            return 'stable is not a boolean';
        }
        if (!('data_version' in val && typeof val.data_version === 'number')) {
            return 'data_version is not a number';
        }
        if (!('protocol_version' in val && typeof val.protocol_version === 'number')) {
            return 'protocol_version is not a number';
        }
        if (!('data_pack_version' in val && typeof val.data_pack_version === 'number')) {
            return 'data_pack_version is not a number';
        }
        if (!('data_pack_version_minor' in val && typeof val.data_pack_version_minor === 'number')) {
            return 'data_pack_version_minor is not a number';
        }
        if (!('resource_pack_version' in val && typeof val.resource_pack_version === 'number')) {
            return 'resource_pack_version is not a number';
        }
        if (!('resource_pack_version_minor' in val
            && typeof val.resource_pack_version_minor === 'number')) {
            return 'resource_pack_version_minor is not a number';
        }
        if (!('build_time' in val && typeof val.build_time === 'string')) {
            return 'build_time is not a string';
        }
        if (!('release_time' in val && typeof val.release_time === 'string')) {
            return 'release_time is not a string';
        }
        if (!('sha1' in val && typeof val.sha1 === 'string')) {
            return 'sha1 is not a string';
        }
        return undefined;
    }
    McmetaVersion.check = check;
    function assert(val) {
        const error = check(val);
        if (error !== undefined) {
            throw new Error(error);
        }
    }
    McmetaVersion.assert = assert;
    function is(val) {
        return check(val) === undefined;
    }
    McmetaVersion.is = is;
})(McmetaVersion || (McmetaVersion = {}));
export var McmetaVersions;
(function (McmetaVersions) {
    function check(val) {
        if (!Array.isArray(val) || val.length === 0) {
            return 'not a non-empty array';
        }
        const badVersion = val.find((v) => !McmetaVersion.is(v));
        if (badVersion) {
            const error = McmetaVersion.check(badVersion);
            return `malformed McmetaVersion ${JSON.stringify(badVersion)}: ${error}`;
        }
        return undefined;
    }
    McmetaVersions.check = check;
    function assert(val) {
        const error = check(val);
        if (error !== undefined) {
            throw new Error(error);
        }
    }
    McmetaVersions.assert = assert;
    function is(val) {
        return check(val) === undefined;
    }
    McmetaVersions.is = is;
})(McmetaVersions || (McmetaVersions = {}));
export var MojangVersionManifestEntry;
(function (MojangVersionManifestEntry) {
    function check(val) {
        if (!core.isObject(val)) {
            return 'not an object';
        }
        if (!('id' in val && typeof val.id === 'string')) {
            return 'id is not a string';
        }
        if (!('type' in val && typeof val.type === 'string')) {
            return 'type is not a string';
        }
        if (!('url' in val && typeof val.url === 'string')) {
            return 'url is not a string';
        }
        if (!('time' in val && typeof val.time === 'string')) {
            return 'time is not a string';
        }
        if (!('releaseTime' in val && typeof val.releaseTime === 'string')) {
            return 'releaseTime is not a string';
        }
        if (!('sha1' in val && typeof val.sha1 === 'string')) {
            return 'sha1 is not a string';
        }
        return undefined;
    }
    MojangVersionManifestEntry.check = check;
    function assert(val) {
        const error = check(val);
        if (error !== undefined) {
            throw new Error(error);
        }
    }
    MojangVersionManifestEntry.assert = assert;
    function is(val) {
        return check(val) === undefined;
    }
    MojangVersionManifestEntry.is = is;
})(MojangVersionManifestEntry || (MojangVersionManifestEntry = {}));
export var MojangVersionManifest;
(function (MojangVersionManifest) {
    function check(val) {
        if (!core.isObject(val)) {
            return 'not an object';
        }
        if (!('versions' in val && Array.isArray(val.versions))) {
            return 'versions is not an array';
        }
        const badEntry = val.versions.find((v) => !MojangVersionManifestEntry.is(v));
        if (badEntry) {
            const error = MojangVersionManifestEntry.check(badEntry);
            return `malformed MojangVersionManifestEntry ${JSON.stringify(badEntry)}: ${error}`;
        }
        return undefined;
    }
    MojangVersionManifest.check = check;
    function assert(val) {
        const error = check(val);
        if (error !== undefined) {
            throw new Error(error);
        }
    }
    MojangVersionManifest.assert = assert;
    function is(val) {
        return check(val) === undefined;
    }
    MojangVersionManifest.is = is;
})(MojangVersionManifest || (MojangVersionManifest = {}));
export var MojangClientJson;
(function (MojangClientJson) {
    function check(val) {
        if (!core.isObject(val)) {
            return 'not an object';
        }
        if (!('downloads' in val && core.isObject(val.downloads))) {
            return 'downloads is not an object';
        }
        if (!('client' in val.downloads && core.isObject(val.downloads.client))) {
            return 'downloads.client is not an object';
        }
        if (!('url' in val.downloads.client && typeof val.downloads.client.url === 'string')) {
            return 'downloads.client.url is not a string';
        }
        return undefined;
    }
    MojangClientJson.check = check;
    function assert(val) {
        const error = check(val);
        if (error !== undefined) {
            throw new Error(error);
        }
    }
    MojangClientJson.assert = assert;
    function is(val) {
        return check(val) === undefined;
    }
    MojangClientJson.is = is;
})(MojangClientJson || (MojangClientJson = {}));
export var MojangVersionJson;
(function (MojangVersionJson) {
    function check(val) {
        if (!core.isObject(val)) {
            return 'not an object';
        }
        if (!('name' in val && typeof val.name === 'string')) {
            return 'name is not a string';
        }
        if (!('pack_version' in val && core.isObject(val.pack_version))) {
            return 'pack_version is not an object';
        }
        if (!('resource_major' in val.pack_version
            && typeof val.pack_version.resource_major === 'number')) {
            return 'pack_version.resource_major is not a number';
        }
        if (!('resource_minor' in val.pack_version
            && typeof val.pack_version.resource_minor === 'number')) {
            return 'pack_version.resource_minor is not a number';
        }
        if (!('data_major' in val.pack_version && typeof val.pack_version.data_major === 'number')) {
            return 'pack_version.data_major is not a number';
        }
        if (!('data_minor' in val.pack_version && typeof val.pack_version.data_minor === 'number')) {
            return 'pack_version.data_minor is not a number';
        }
        if (!('protocol_version' in val && typeof val.protocol_version === 'number')) {
            return 'protocol_version is not a number';
        }
        if (!('stable' in val && typeof val.stable === 'boolean')) {
            return 'stable is not a boolean';
        }
        if (!('world_version' in val && typeof val.world_version === 'number')) {
            return 'world_version is not a number';
        }
        if (!('build_time' in val && typeof val.build_time === 'string')) {
            return 'build_time is not a string';
        }
        return undefined;
    }
    MojangVersionJson.check = check;
    function assert(val) {
        const error = check(val);
        if (error !== undefined) {
            throw new Error(error);
        }
    }
    MojangVersionJson.assert = assert;
    function is(val) {
        return check(val) === undefined;
    }
    MojangVersionJson.is = is;
})(MojangVersionJson || (MojangVersionJson = {}));
//# sourceMappingURL=types.js.map