
#!/usr/bin/env node

/**
 * Production Build Optimization Script for Devonn.AI
 * 
 * This script performs various optimizations on the production build:
 * 1. Minifies and compresses JS/CSS files
 * 2. Optimizes images
 * 3. Removes unnecessary files
 * 4. Validates the final build
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

// Configuration
const distDir = path.join(__dirname, '../dist');
const assetsDir = path.join(distDir, 'assets');
const jsDir = path.join(distDir, 'js');
const cssDir = path.join(distDir, 'css');

console.log('=== Devonn.AI Production Build Optimizer ===');

// Ensure the dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ Error: dist directory not found. Run build first.');
  process.exit(1);
}

// Helper function to format file size
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Helper function to recursive get all files
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// 1. Generate a build report
console.log('\n📊 Generating build report...');

const allFiles = getAllFiles(distDir);
const totalSizeBeforeOptimization = allFiles.reduce((total, file) => {
  return total + fs.statSync(file).size;
}, 0);

console.log(`Total build size before optimization: ${formatSize(totalSizeBeforeOptimization)}`);
console.log(`Total number of files: ${allFiles.length}`);

// File type breakdown
const fileTypes = allFiles.reduce((types, file) => {
  const ext = path.extname(file).toLowerCase();
  if (!types[ext]) types[ext] = { count: 0, size: 0 };
  
  types[ext].count++;
  types[ext].size += fs.statSync(file).size;
  
  return types;
}, {});

console.log('\nFile type breakdown:');
Object.entries(fileTypes).sort((a, b) => b[1].size - a[1].size).forEach(([ext, data]) => {
  console.log(`${ext}: ${data.count} files (${formatSize(data.size)})`);
});

// 2. Optimize JavaScript files
console.log('\n🔧 Optimizing JavaScript files...');

try {
  // Check if terser is available
  const terserInstalled = execSync('npm list terser --depth=0', { stdio: 'pipe' }).toString().includes('terser');
  
  if (!terserInstalled) {
    console.log('Installing terser...');
    execSync('npm install --no-save terser', { stdio: 'inherit' });
  }
  
  let jsFilesOptimized = 0;
  let jsSavings = 0;
  
  // Find all JS files
  const jsFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.js');
  
  jsFiles.forEach(file => {
    const originalSize = fs.statSync(file).size;
    const content = fs.readFileSync(file, 'utf8');
    
    // Skip already minified files
    if (file.includes('.min.js') || content.length < 500) return;
    
    try {
      // Minify the file
      const result = execSync(`npx terser "${file}" --compress --mangle --output "${file}"`, { stdio: 'pipe' });
      
      const optimizedSize = fs.statSync(file).size;
      const savings = originalSize - optimizedSize;
      jsSavings += savings;
      jsFilesOptimized++;
      
      console.log(`Optimized: ${path.relative(distDir, file)} (${formatSize(savings)} saved)`);
    } catch (err) {
      console.warn(`Warning: Failed to optimize ${file}`);
    }
  });
  
  console.log(`\n✓ Optimized ${jsFilesOptimized} JavaScript files, saved ${formatSize(jsSavings)}`);
} catch (err) {
  console.error('❌ JavaScript optimization failed:', err.message);
}

// 3. Optimize CSS files if any exist
console.log('\n🔧 Optimizing CSS files...');

try {
  // Find all CSS files
  const cssFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.css');
  
  if (cssFiles.length > 0) {
    // Check if cssnano is available
    const cssnanoInstalled = execSync('npm list cssnano --depth=0', { stdio: 'pipe' }).toString().includes('cssnano');
    const postcssCliInstalled = execSync('npm list postcss-cli --depth=0', { stdio: 'pipe' }).toString().includes('postcss-cli');
    
    if (!cssnanoInstalled || !postcssCliInstalled) {
      console.log('Installing CSS optimization dependencies...');
      execSync('npm install --no-save cssnano postcss postcss-cli', { stdio: 'inherit' });
    }
    
    // Create a temporary PostCSS config
    const postcssConfigPath = path.join(__dirname, 'temp-postcss.config.js');
    fs.writeFileSync(postcssConfigPath, `
      module.exports = {
        plugins: [
          require('cssnano')({
            preset: ['default', {
              discardComments: { removeAll: true },
              normalizeWhitespace: true,
              minifyFontValues: true,
              minifyGradients: true
            }]
          })
        ]
      };
    `);
    
    let cssFilesOptimized = 0;
    let cssSavings = 0;
    
    cssFiles.forEach(file => {
      const originalSize = fs.statSync(file).size;
      
      // Skip already minified files
      if (file.includes('.min.css') || originalSize < 500) return;
      
      try {
        // Minify the file
        execSync(`npx postcss "${file}" --config "${postcssConfigPath}" --replace`, { stdio: 'pipe' });
        
        const optimizedSize = fs.statSync(file).size;
        const savings = originalSize - optimizedSize;
        cssSavings += savings;
        cssFilesOptimized++;
        
        console.log(`Optimized: ${path.relative(distDir, file)} (${formatSize(savings)} saved)`);
      } catch (err) {
        console.warn(`Warning: Failed to optimize ${file}`);
      }
    });
    
    // Remove temporary config
    fs.unlinkSync(postcssConfigPath);
    
    console.log(`\n✓ Optimized ${cssFilesOptimized} CSS files, saved ${formatSize(cssSavings)}`);
  } else {
    console.log('No CSS files found to optimize.');
  }
} catch (err) {
  console.error('❌ CSS optimization failed:', err.message);
}

// 4. Optimize images
console.log('\n🔧 Optimizing images...');

try {
  // Find all image files
  const imageFiles = allFiles.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext);
  });
  
  if (imageFiles.length > 0) {
    // Check if sharp is available
    const sharpInstalled = execSync('npm list sharp --depth=0', { stdio: 'pipe' }).toString().includes('sharp');
    
    if (!sharpInstalled) {
      console.log('Installing image optimization dependencies...');
      execSync('npm install --no-save sharp', { stdio: 'inherit' });
    }
    
    // Create a temporary script for image optimization
    const imageOptimScript = path.join(__dirname, 'temp-image-optim.js');
    fs.writeFileSync(imageOptimScript, `
      const sharp = require('sharp');
      const fs = require('fs');
      const path = require('path');

      const file = process.argv[2];
      const ext = path.extname(file).toLowerCase();
      
      async function optimizeImage() {
        let instance = sharp(file);
        
        if (ext === '.svg') {
          // For SVGs, we'll just read and write to trigger SVGO in sharp
          await instance.toFile(file + '.temp');
          fs.renameSync(file + '.temp', file);
          return;
        }
        
        if (['.jpg', '.jpeg'].includes(ext)) {
          instance = instance.jpeg({ quality: 80, progressive: true });
        } else if (ext === '.png') {
          instance = instance.png({ compressionLevel: 9, progressive: true });
        } else if (ext === '.gif') {
          // GIFs need special handling, we'll just pass them through
          return;
        }
        
        await instance.toFile(file + '.temp');
        fs.renameSync(file + '.temp', file);
      }
      
      optimizeImage().catch(err => {
        console.error('Failed to optimize ' + file, err);
        process.exit(1);
      });
    `);
    
    let imageFilesOptimized = 0;
    let imageSavings = 0;
    
    for (const file of imageFiles) {
      const originalSize = fs.statSync(file).size;
      
      try {
        // Optimize the image
        execSync(`node "${imageOptimScript}" "${file}"`, { stdio: 'pipe' });
        
        const optimizedSize = fs.statSync(file).size;
        const savings = originalSize - optimizedSize;
        
        // Only count if we actually saved space
        if (savings > 0) {
          imageSavings += savings;
          imageFilesOptimized++;
          console.log(`Optimized: ${path.relative(distDir, file)} (${formatSize(savings)} saved)`);
        }
      } catch (err) {
        console.warn(`Warning: Failed to optimize ${file}`);
      }
    }
    
    // Remove temporary script
    fs.unlinkSync(imageOptimScript);
    
    console.log(`\n✓ Optimized ${imageFilesOptimized} image files, saved ${formatSize(imageSavings)}`);
  } else {
    console.log('No image files found to optimize.');
  }
} catch (err) {
  console.error('❌ Image optimization failed:', err.message);
}

// 5. Compress files
console.log('\n🔧 Compressing files for serving with Brotli and Gzip...');

try {
  const compressibleExtensions = ['.js', '.css', '.html', '.svg', '.json', '.txt', '.md', '.xml'];
  const filesToCompress = allFiles.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return compressibleExtensions.includes(ext);
  });
  
  let compressedCount = 0;
  let totalOriginalSize = 0;
  let totalGzipSize = 0;
  let totalBrotliSize = 0;
  
  for (const file of filesToCompress) {
    const content = fs.readFileSync(file);
    const originalSize = content.length;
    totalOriginalSize += originalSize;
    
    // Gzip compression
    try {
      const gzipped = zlib.gzipSync(content, { level: 9 });
      fs.writeFileSync(`${file}.gz`, gzipped);
      totalGzipSize += gzipped.length;
    } catch (err) {
      console.warn(`Warning: Failed to gzip compress ${file}`);
    }
    
    // Brotli compression
    try {
      const brotlied = zlib.brotliCompressSync(content, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        },
      });
      fs.writeFileSync(`${file}.br`, brotlied);
      totalBrotliSize += brotlied.length;
    } catch (err) {
      console.warn(`Warning: Failed to brotli compress ${file}`);
    }
    
    compressedCount++;
  }
  
  console.log(`\n✓ Compressed ${compressedCount} files:`);
  console.log(`Original size: ${formatSize(totalOriginalSize)}`);
  console.log(`Gzip size: ${formatSize(totalGzipSize)} (${(totalGzipSize / totalOriginalSize * 100).toFixed(2)}%)`);
  console.log(`Brotli size: ${formatSize(totalBrotliSize)} (${(totalBrotliSize / totalOriginalSize * 100).toFixed(2)}%)`);
} catch (err) {
  console.error('❌ File compression failed:', err.message);
}

// 6. Validate final build
console.log('\n✅ Validating final build...');

try {
  // Check manifest.json
  const manifestPath = path.join(distDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json not found');
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Validate manifest
  const requiredFields = ['name', 'version', 'manifest_version'];
  const missingFields = requiredFields.filter(field => !manifest[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`manifest.json is missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Check for existence of key files
  const necessaryFiles = ['popup.html', 'background.js'];
  const missingFiles = necessaryFiles.filter(file => !fs.existsSync(path.join(distDir, file)));
  
  if (missingFiles.length > 0) {
    throw new Error(`Missing necessary files: ${missingFiles.join(', ')}`);
  }
  
  // Final size calculation
  const finalSize = getAllFiles(distDir).reduce((total, file) => {
    // Skip the .gz and .br files we just created
    if (file.endsWith('.gz') || file.endsWith('.br')) return total;
    return total + fs.statSync(file).size;
  }, 0);
  
  const sizeDifference = totalSizeBeforeOptimization - finalSize;
  const percentReduction = (sizeDifference / totalSizeBeforeOptimization * 100).toFixed(2);
  
  console.log(`\n✓ Build validation complete`);
  console.log(`Final build size: ${formatSize(finalSize)}`);
  console.log(`Size reduction: ${formatSize(sizeDifference)} (${percentReduction}%)`);
  
  // Create a build report file
  const buildReport = {
    timestamp: new Date().toISOString(),
    originalSize: totalSizeBeforeOptimization,
    finalSize,
    reduction: sizeDifference,
    percentReduction,
    fileTypes,
    manifestVersion: manifest.version,
  };
  
  fs.writeFileSync(
    path.join(distDir, 'build-report.json'),
    JSON.stringify(buildReport, null, 2)
  );
  
  console.log('\n🎉 Build optimization complete! Build report saved to dist/build-report.json');
} catch (err) {
  console.error('❌ Build validation failed:', err.message);
  process.exit(1);
}
