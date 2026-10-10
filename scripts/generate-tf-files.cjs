const fs = require('fs');
const { terraformManifestYaml } = require('../src/data/manifest/terraform/index.cjs');

try {
  fs.writeFileSync('./src/data/manifest/terraform/main.tf', terraformManifestYaml);
  console.log('main.tf generated successfully');
} catch (err) {
  console.error('Error:', err);
}
