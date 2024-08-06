/*
    Copyright (c) 2024 Alan de Freitas (alandefreitas@gmail.com)
    Copyright (c) 2023 Vinnie Falco (vinnie.falco@gmail.com)

    Distributed under the Boost Software License, Version 1.0. (See accompanying
    file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)

    Official repository: https://github.com/alandefreitas/antora-cpp-tagfiles-extension
*/

'use strict'

'use strict'

const fs = require('node:fs');
const path = require('node:path');
const process = require("process");
const {execSync} = require('child_process');

const PACKAGE_NAME = 'playbook-macros-extension'

/**
 * PlaybookMacrosExtension is an extension that allows the playbook to include
 * macros that will be expanded in the playbook's attributes.
 *
 * The values of the macros are determined from the command line, from the environment,
 * or from the playbook itself.
 *
 * See https://docs.antora.org/antora/latest/extend/class-based-extension/
 *
 * @class
 * @property {Object} context - The generator context.
 * @property {Array} tagfiles - An array of tagfile objects.
 * @property {Object} logger - The logger object.
 * @property {Object} config - The configuration object.
 * @property {Object} playbook - The playbook object.
 *
 */
class PlaybookMacrosExtension {
    static register({config, playbook}) {
        new PlaybookMacrosExtension(this, {config, playbook})
    }

    constructor(generatorContext, {config, playbook}) {
        this.context = generatorContext
        const onContextStartedFn = this.onContextStarted.bind(this)
        this.context.once('contextStarted', onContextStartedFn)

        // https://www.npmjs.com/package/@antora/logger
        // https://github.com/pinojs/pino/blob/main/docs/api.md
        this.logger = this.context.getLogger(PACKAGE_NAME)
        this.logger.debug(`Registering ${PACKAGE_NAME}`)

        this.playbook = playbook
        this.config = config

        // Make a deep copy of this.config.macros
        this.macros = JSON.parse(JSON.stringify(this.config.macros || {}))
    }

    /**
     * Event handler for the 'contextStarted' event.
     *
     * This is the first event triggered after `register` is called.
     * The only in-scope variable is playbook.
     *
     * This method reads all the macros from the playbook and
     * expands them.
     *
     * @param {Object} playbook - The playbook object.
     */
    async onContextStarted({playbook}) {
        this.replacePatterns(playbook)
        this.logger.debug(playbook, `Playbook after expansion`)
    }

    /**
     * Recursively replaces all occurrences of attribute placeholders in a playbook
     * with their corresponding attribute values.
     *
     * @param {Object} playbook - The playbook to modify.
     * @returns {void}
     */
    replacePatterns(playbook) {
        this.replaceAll(playbook.asciidoc.attributes)
        this.replaceAll(playbook.asciidoc)
        this.replaceAll(playbook.site)
        this.replaceAll(playbook.urls)
        this.replaceAll(playbook.content)
        this.replaceAll(playbook.output)
        this.replaceAll(playbook.ui)
        this.replaceAll(playbook.antora)
    }

    /**
     * Recursively replaces all occurrences of a pattern with a substitution string
     * in an object or array of strings.
     *
     * @param {Array|Object} obj - The object or array to modify.
     * @returns {void}
     */
    replaceAll(obj) {
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                if (typeof obj[i] === "string") {
                    obj[i] = this.replaceAllMacros(obj[i])
                } else if (typeof obj[i] === "object") {
                    this.replaceAll(obj[i]);
                }
            }
        } else if (typeof obj === "object" && obj !== null) {
            for (const [key, val] of Object.entries(obj)) {
                if (typeof val === "string") {
                    obj[key] = this.replaceAllMacros(val)
                } else if (typeof val === "object") {
                    this.replaceAll(val);
                }
            }
        }
    }

    /**
     * Replaces all occurrences of macros in a string with their corresponding values.
     *
     * @param str - The string to modify.
     * @return {*} The modified string.
     */
    replaceAllMacros(str) {
        const re = /\$\{([^}]+)\}/g;
        return str.replace(re, (match, macro) => this.getMacroValue(macro))
    }

    /**
     * Returns the value of a macro.
     *
     * The value is determined from the command line, from the environment,
     * or from the playbook itself.
     *
     * @param macro
     * @return {undefined|*|string}
     */
    getMacroValue(macro) {
        if (macro in process.env) {
            return process.env[macro]
        }
        if (macro.toUpperCase() in process.env) {
            return process.env[macro]
        }
        if (macro in this.playbook.asciidoc.attributes) {
            return this.playbook.asciidoc.attributes[macro]
        }
        if (macro in this.macros) {
            return this.macros[macro]
        }
        if (macro === 'branch') {
            const execSyncOpts = {cwd: PlaybookMacrosExtension.getGitDir()}
            if (execSyncOpts.cwd) {
                try {
                    const branch = execSync('git rev-parse --abbrev-ref HEAD', execSyncOpts).toString().trim();
                    this.macros[macro] = branch
                    return branch
                } catch (error) {
                    this.logger.warn(`Macro ${macro} not found: ${error}`)
                    return undefined
                }
            }
        }
        if (macro === 'commit-id') {
            const execSyncOpts = {cwd: PlaybookMacrosExtension.getGitDir()}
            if (execSyncOpts.cwd) {
                try {
                    const commitId = execSync('git rev-parse HEAD', execSyncOpts).toString().trim().substring(0, 7);
                    this.macros[macro] = commitId
                    return commitId
                } catch (error) {
                    this.logger.warn(`Macro ${macro} not found: ${error}`)
                    return undefined
                }
            }
        }
        this.logger.warn(`Macro ${macro} not found`)
        return undefined
    }

    static getGitDir() {
        let cwd = process.cwd()
        const root = path.parse(cwd).root;
        while (cwd !== root) {
            if (fs.existsSync(path.join(cwd, '.git'))) {
                return cwd
            }
            cwd = path.dirname(cwd)
        }
        return null
    }
}

module.exports = PlaybookMacrosExtension
