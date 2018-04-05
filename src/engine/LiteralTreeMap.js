const Functor = require('./Functor');
const Value = require('./Value');
const Variable = require('./Variable');

function __TreeLoaderType() {}

function deepCopy(obj) {
  if (obj instanceof Array) {
    return obj.map(x => deepCopy(x));
  }
  return obj;
}

function __TreeNode(size, tree) {
  this._size = size;
  this._tree = tree;

  if (this._size === undefined) {
    this._size = 0;
  }

  if (this._tree === undefined) {
    this._tree = {};
  }

  this.clone = function() {
    let clone = new __TreeNode(size, {});
    let indices = this.indices();
    indices.forEach((index) => {
      if (this._tree[index] instanceof __TreeNode) {
        clone._tree[index] = this._tree[index].clone();
        return ;
      }
      clone._tree[index] = deepCopy(this._tree[index]);
    });
  }

  this.indices = function indices() {
    let indices = Object.getOwnPropertySymbols(this._tree)
      .concat(Object.getOwnPropertyNames(this._tree));
    return indices;
  }
}

function LiteralTreeMap() {
  let _root = new __TreeNode();
  let _count = 0;
  let _variableSymbol = Symbol();

  // only create an argument tree when needed otherwise we incur infinite loop
  let _argumentTreeSymbol = null;
  let _argumentClauses = {};

  this.add = function add(literal, valueArg) {
    let node = _root;
    let value = valueArg;
    if (value === undefined) {
      value = literal;
    }

    let args = literal;

    let createIfNotExist = (nArg, subtree) => {
      let n = nArg;
      if (n._tree[subtree] === undefined) {
        n._size += 1;
        n._tree[subtree] = new __TreeNode();
      }
    };

    if (literal instanceof Functor) {
      createIfNotExist(node, literal.getName());
      node = node._tree[literal.getName()];

      args = literal.getArguments();
    }

    createIfNotExist(node, args.length);
    node = node._tree[args.length];

    args.forEach((arg, idx) => {
      let nodeRep = null;
      if (!(arg instanceof Value) && !(arg instanceof Variable)) {
        // use another tree to index this argument
        if (_argumentTreeSymbol === null) {
          _argumentTreeSymbol = new LiteralTreeMap();
        } else {
          nodeRep = _argumentTreeSymbol.get(arg);
        }
        if (nodeRep === null) {
          nodeRep = Symbol();
          _argumentClauses[nodeRep] = arg;
          _argumentTreeSymbol.add(arg, nodeRep);
        }
      } else if (arg instanceof Variable) {
        nodeRep = _variableSymbol;
      } else {
        nodeRep = arg.evaluate();
      }
      if (idx === args.length - 1) {
        node._size += 1;
        node._tree[nodeRep] = value;
        return;
      }

      createIfNotExist(node, nodeRep);
      node = node._tree[nodeRep];
    });
    _count += 1;
  };

  let flattenLiteral = function flattenLiteral(literal) {
    let args = literal;
    let result = [];
    if (literal instanceof Functor) {
      result.push(literal.getName());
      args = literal.getArguments();
    }
    result.push(args.length);
    result = result.concat(args);
    return result
  };

  let buildGetIndexPath = function buildGetIndexPath(literal) {
    let args = literal;
    let path = [];
    if (literal instanceof Functor) {
      path.push(literal.getName());
      args = literal.getArguments();
    }
    path.push(args.length);

    for (let i = 0; i < args.length; i += 1) {
      let arg = args[i];
      let nodeRep = null;
      if (!(arg instanceof Value) && !(arg instanceof Variable)) {
        // use another tree to index this argument
        if (_argumentTreeSymbol === null) {
          return null;
        }

        nodeRep = _argumentTreeSymbol.get(arg);
        if (!nodeRep) {
          return null;
        }
      } else if (arg instanceof Variable) {
        nodeRep = _variableSymbol;
      } else {
        nodeRep = arg.evaluate();
      }

      path.push(nodeRep);
    }
    return path;
  };

  this.get = function get(literal) {
    let path = buildGetIndexPath(literal);
    if (path === null) {
      return null;
    }

    let lastPathIndex = path.length - 1;
    let recursiveGet = (node, i) => {
      if (i >= path.length) {
        return null;
      }
      if (node._size === 0) {
        return null;
      }
      let index = path[i];
      if (node._tree[index] === undefined) {
        return null;
      }
      if (i === lastPathIndex) {
        return node._tree[index];
      }

      return recursiveGet(node._tree[index], i + 1);
    };
    return recursiveGet(_root, 0);
  };

  this.contains = function contains(literal) {
    let path = buildGetIndexPath(literal);
    if (path === null) {
      return false;
    }

    let lastPathIndex = path.length - 1;
    let recursiveCheck = (node, i) => {
      if (i >= path.length) {
        return false;
      }
      if (node._size === 0) {
        return false;
      }
      let index = path[i];
      if (node._tree[index] === undefined) {
        return false;
      }
      if (i === lastPathIndex) {
        return true;
      }

      return recursiveCheck(node._tree[index], i + 1);
    };
    return recursiveCheck(_root, 0);
  };

  this.remove = function remove(literal) {
    let path = buildGetIndexPath(literal);
    if (path === null) {
      return false;
    }

    let lastPathIndex = path.length - 1;
    let recursiveRemove = (nodeArg, i) => {
      let node = nodeArg;
      if (i >= path.length) {
        return false;
      }
      if (node._size === 0) {
        return false;
      }
      let index = path[i];
      if (node._tree[index] === undefined) {
        return false;
      }
      if (i === lastPathIndex) {
        delete node._tree[index];
        return true;
      }

      let result = recursiveRemove(node._tree[index], i + 1);
      if (result) {
        node._tree[index]._size -= 1;
        if (node._tree[index]._size === 0) {
          _count -= 1;
          delete node._tree[index];
          return true;
        }
      }
      return false;
    };
    let lastCount = _count;
    recursiveRemove(_root, 0);
    return _count < lastCount;
  };

  this.clear = function clear() {
    _root = {
      _size: 0,
      _tree: {}
    };
    _count = 0;
    _argumentTreeSymbol = null;
  };

  this.size = function size() {
    return _count;
  };

  this.toArray = function toArray() {
    let result = [];

    let recursiveBuild = (node) => {
      if (node instanceof Functor || node instanceof Array) {
        result.push(node);
        return;
      }
      let indices = node.indices();
      indices.forEach((key) => {
        recursiveBuild(node._tree[key]);
      });
    };
    recursiveBuild(_root);
    return result;
  };

  this.forEach = function forEach(callback) {
    let recursiveTraverse = (node) => {
      if (node instanceof Functor || node instanceof Array) {
        callback(node);
        return;
      }
      let indices = node.indices();
      indices.forEach((key) => {
        recursiveTraverse(node._tree[key]);
      });
    };
    recursiveTraverse(_root);
  };

  this.clone = function clone() {
    if (this instanceof __TreeLoaderType) {
      return (tree) => {
        _count = tree.count;
        _root = tree.root.clone();
        _argumentTreeSymbol = null;
        _argumentClauses = null;
        _variableSymbol = tree.variableSymbol;
        if (tree.argumentTree !== null) {
          _argumentTreeSymbol = tree.argumentTree.clone();
          _argumentClauses = tree.argumentClauses.map(x => x);
        }
      }
    }
    let clone = new LiteralTreeMap()
    let loader = clone.clone.call(new __TreeLoaderType());
    loader({
      root: _root,
      count: _count,
      variableSymbol: _variableSymbol,
      argumentTree: _argumentTreeSymbol,
      argumentClauses: _argumentClauses
    });
    return clone;
  };
}

module.exports = LiteralTreeMap;
