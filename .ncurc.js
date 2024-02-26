// List packages for minor updates
const minorUpdatePackages = ['chai']
module.exports = {
  target: packageName => {
    return minorUpdatePackages.includes(packageName) ? 'minor' : 'latest'
  }
}