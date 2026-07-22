/**
 * @fileoverview ToolRegistry — a directory of available tool instances.
 *
 * The registry stores and retrieves plain tool instances (e.g.
 * SearchProductsTool, CompareProductsTool — see ai/tools) by name. It has
 * no knowledge of AI function-calling metadata (descriptions, input
 * schemas, handlers) and no knowledge of any specific reasoning provider's
 * function-calling format. Adapting a tool instance into whatever format a
 * given reasoning provider expects is a concern for that provider
 * integration, not for this registry.
 */

class ToolRegistry {
  constructor() {
    /**
     * Internal storage for registered tool instances, keyed by name.
     * @type {Map<string, Object>}
     * @private
     */
    this._tools = new Map();
  }

  /**
   * Registers a tool instance under a given name.
   *
   * @param {string} name - Unique name to register the tool under.
   * @param {Object} tool - The tool instance (e.g. an instance of
   *   SearchProductsTool, CompareProductsTool, etc.).
   * @returns {void}
   */
  registerTool(name, tool) {
    if (!name || typeof name !== 'string') {
      throw new Error('Tool name is required and must be a string');
    }
    if (typeof tool !== 'object' || tool === null) {
      throw new Error(`Tool "${name}" must be an object instance`);
    }
    if (this._tools.has(name)) {
      throw new Error(`A tool named "${name}" is already registered`);
    }
    this._tools.set(name, tool);
  }

  /**
   * Retrieves a single registered tool instance by name.
   *
   * @param {string} name - The tool's registered name.
   * @returns {Object} The registered tool instance.
   */
  getTool(name) {
    const tool = this._tools.get(name);
    if (!tool) {
      throw new Error(`No tool registered under the name "${name}"`);
    }
    return tool;
  }

  /**
   * Retrieves all registered tool instances.
   *
   * @returns {Object[]} All registered tool instances.
   */
  getAllTools() {
    return Array.from(this._tools.values());
  }
}

module.exports = ToolRegistry;