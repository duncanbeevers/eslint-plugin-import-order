'use strict';

var find = require('lodash.find');
var utils = require('../utils');

var defaultOrder = ['builtin', 'external', 'parent', 'sibling', 'index'];

function isStaticRequire(node) {
  return node &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'require' &&
    node.arguments.length === 1 &&
    node.arguments[0].type === 'Literal';
}

function computeRank(order, name) {
  return order.indexOf(utils.importType(name));
}

function reportIfPresentAfterLowerRank(context, node, name, rank, imported) {
  var found = find(imported, function hasHigherRank(importedItem) {
    return importedItem.rank > rank;
  });
  if (found) {
    context.report(node, '`' + name + '` import should occur before import of `' + found.name + '`');
  }
}

function treatNode(context, node, name, order, imported) {
  var rank = computeRank(order, name);
  if (rank !== -1) {
    reportIfPresentAfterLowerRank(context, node, name, rank, imported);
    imported.push({name: name, rank: rank});
  }
}

/* eslint quote-props: [2, "as-needed"] */
module.exports = function importOrderRule(context) {
  var imported = [];
  var options = context.options[0] || {};
  var order = options.order || defaultOrder;
  var level = 0;

  function incrementLevel() {
    level++;
  }
  function decrementLevel() {
    level--;
  }

  return {
    ImportDeclaration: function handleImports(node) {
      if (node.specifiers.length) { // Ignoring unassigned imports
        var name = node.source.value;
        treatNode(context, node, name, order, imported);
      }
    },
    VariableDeclarator: function handleRequires(node) {
      if (level !== 0 || !isStaticRequire(node.init)) {
        return;
      }
      var name = node.init.arguments[0].value;
      treatNode(context, node.init, name, order, imported);
    },
    FunctionDeclaration: incrementLevel,
    FunctionExpression: incrementLevel,
    ArrowFunctionExpression: incrementLevel,
    BlockStatement: incrementLevel,
    'FunctionDeclaration:exit': decrementLevel,
    'FunctionExpression:exit': decrementLevel,
    'ArrowFunctionExpression:exit': decrementLevel,
    'BlockStatement.exit': decrementLevel,
    'Program.exit': function reset() {
      imported = [];
    }
  };
};

module.exports.schema = [
  {
    type: 'object',
    properties: {
      order: {
        type: 'array',
        uniqueItems: true,
        length: 5,
        items: {
          enum: defaultOrder
        }
      }
    },
    additionalProperties: false
  }
];
