/*
    Copyright (c) 2024 Alan de Freitas (alandefreitas@gmail.com)

    Distributed under the Boost Software License, Version 1.0. (See accompanying
    file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)

    Official repository: https://github.com/alandefreitas/antora-cpp-tagfiles-extension
*/

'use strict'

const test = require("node:test");
const {describe, it} = test;
const {ok, strictEqual, deepStrictEqual} = require("node:assert");

const fs = require('fs');
const PlaybookMacrosExtension = require('../lib/extension.js');
const path = require('path');
const yaml = require("js-yaml");
const process = require("process");

class generatorContext {
    constructor() {
        this.attributes = {}
    }

    on(eventName, Function) {
        ok(eventName === 'contextStarted')
    }

    once(eventName, Function) {
        ok(eventName === 'contextStarted')
    }

    getLogger(name) {
        ok(name === 'playbook-macros-extension')
        const noop = () => {
        }
        return {trace: noop, debug: noop, info: noop, warn: noop, error: noop}
    }
}

describe('Playbook Macros Extension', () => {
    const fixturesDir = path.join(__dirname, 'fixtures')

    // ============================================================
    // Iterate fixtures and run tests
    // ============================================================
    for (const fixture of fs.readdirSync(fixturesDir)) {
        const playbookFile = path.join(fixturesDir, fixture)
        const isYaml = playbookFile.endsWith('.yml') || playbookFile.endsWith('.yaml')
        if (!isYaml) {
            continue
        }
        const isOutYaml = playbookFile.endsWith('.out.yml') || playbookFile.endsWith('.out.yaml')
        if (isOutYaml) {
            continue
        }
        const fixtureBasename = path.basename(fixture, path.extname(fixture))
        const outYaml = path.join(fixturesDir, `${fixtureBasename}.out.yml`)
        test(fixture, () => {
            const playbookContents = fs.readFileSync(playbookFile, 'utf8')
            const playbook = yaml.load(playbookContents)
            ok(playbook, `Fixture ${fixture} has an invalid playbook.yml`)
            const config = playbook.antora.extensions.find(extension => extension.require === '@alandefreitas/antora-playbook-macros-extension')
            ok(config, `Fixture ${fixture} is missing the extension @alandefreitas/antora-playbook-macros-extension`)
            const context = new generatorContext();
            const extension = new PlaybookMacrosExtension(context, {config, playbook})
            ok(extension, `Fixture ${fixture} failed to create the extension`)
            process.env['cxx'] = 'clang++'
            extension.onContextStarted({playbook})
            // Check if outYaml exists
            if (fs.existsSync(outYaml)) {
                const outContents = fs.readFileSync(outYaml, 'utf8')
                const outPlaybook = yaml.load(outContents)
                deepStrictEqual(playbook, outPlaybook, `Fixture ${fixture} failed`)
            } else {
                const playbookYaml = yaml.dump(playbook)
                fs.writeFileSync(outYaml, playbookYaml)
            }
        })
    }
});

