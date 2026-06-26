function readPackage(pkg) {
  // Force qs to patched version in all transitive dependencies
  if (pkg.dependencies && pkg.dependencies.qs) {
    pkg.dependencies.qs = '>=6.15.2';
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
