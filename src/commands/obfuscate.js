const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const JavaScriptObfuscator = require('javascript-obfuscator');
const AdmZip = require('adm-zip');
const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('obfuscate')
        .setDescription('Obfuscates a JS file or all JS files within a ZIP archive.')
        .addAttachmentOption(option =>
            option.setName('attachment')
                .setDescription('The .js or .zip file to obfuscate.')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('removecomments')
                .setDescription('Set to true to remove comments before obfuscating.')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const attachment = interaction.options.getAttachment('attachment');
        const removeComments = interaction.options.getBoolean('removecomments') ?? false;

        // --- Handle single .js file ---
        if (attachment.name.endsWith('.js')) {
            return await handleSingleFile(interaction, attachment, removeComments);
        }

        // --- Handle .zip file ---
        if (attachment.name.endsWith('.zip')) {
            return await handleZipFile(interaction, attachment, removeComments);
        }

        // --- Invalid file type ---
        return await interaction.editReply({
            content: '❌ **Invalid File Type:** Please upload a `.js` or `.zip` file.'
        });
    }
};

/**
 * Handles the logic for a single JavaScript file.
 */
async function handleSingleFile(interaction, attachment, removeComments) {
    try {
        const response = await fetch(attachment.url);
        let code = await response.text();

        if (removeComments) {
            code = removeCommentsFromCode(code);
        }

        const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, getObfuscatorOptions()).getObfuscatedCode();
        const buffer = Buffer.from(obfuscatedCode, 'utf-8');
        const resultAttachment = new AttachmentBuilder(buffer, { name: `obfuscated_${attachment.name}` });

        await interaction.editReply({
            content: `✅ **Success!** Your file \`${attachment.name}\` has been obfuscated.`,
            files: [resultAttachment]
        });
    } catch (error) {
        console.error('Single File Obfuscation Error:', error);
        await interaction.editReply({
            content: `❌ **An Error Occurred:**\n\`\`\`${error.message}\`\`\``
        });
    }
}

/**
 * Handles the logic for a .zip archive.
 */
async function handleZipFile(interaction, attachment, removeComments) {
    // Create a unique temporary directory for this operation
    const tempDir = path.join(__dirname, '..', 'temp', interaction.id);

    try {
        // 1. Create temp directory
        await fs.mkdir(tempDir, { recursive: true });

        // 2. Download and save the zip file
        const zipPath = path.join(tempDir, attachment.name);
        const response = await fetch(attachment.url);
        if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);
        const fileBuffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(zipPath, fileBuffer);

        // 3. Unpack the zip
        const sourceDir = path.join(tempDir, 'source');
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(sourceDir, /*overwrite*/ true);

        // 4. Recursively find and obfuscate all .js files
        await processDirectory(sourceDir, removeComments);

        // 5. Repack the obfuscated directory into a new zip
        const newZip = new AdmZip();
        newZip.addLocalFolder(sourceDir);
        const newZipBuffer = newZip.toBuffer();

        // 6. Send the result
        const resultAttachment = new AttachmentBuilder(newZipBuffer, { name: `obfuscated_${attachment.name}` });
        await interaction.editReply({
            content: `✅ **Success!** All JavaScript files in \`${attachment.name}\` have been obfuscated.`,
            files: [resultAttachment]
        });

    } catch (error) {
        console.error('ZIP Obfuscation Error:', error);
        await interaction.editReply({
            content: `❌ **An Error Occurred:**\n\`\`\`${error.message}\`\`\``
        });
    } finally {
        // 7. CRITICAL: Clean up the temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
    }
}

/**
 * Recursively traverses a directory, obfuscating all .js files found.
 * @param {string} directoryPath The path to the directory to process.
 * @param {boolean} removeComments Whether to remove comments before obfuscating.
 */
async function processDirectory(directoryPath, removeComments) {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            await processDirectory(fullPath, removeComments); // Recurse into subdirectory
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            try {
                // Read the JS file
                let code = await fs.readFile(fullPath, 'utf-8');
                
                // Pre-process if needed
                if (removeComments) {
                    code = removeCommentsFromCode(code);
                }
                
                // Validate syntax before obfuscation (handle ES6 modules)
                if (!isValidJavaScript(code, fullPath)) {
                    continue;
                }
                
                // Obfuscate and overwrite the file
                const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, getObfuscatorOptions()).getObfuscatedCode();
                await fs.writeFile(fullPath, obfuscatedCode, 'utf-8');
                
            } catch (error) {
                console.error(`Error processing file ${fullPath}:`, error.message);
                // Continue processing other files instead of failing completely
            }
        }
    }
}

/**
 * Safely removes comments from JavaScript code while preserving string literals.
 * @param {string} code The JavaScript code to process.
 * @returns {string} The code with comments removed.
 */
function removeCommentsFromCode(code) {
    let result = '';
    let i = 0;
    let inString = false;
    let stringChar = '';
    let inRegex = false;
    let inSingleLineComment = false;
    let inMultiLineComment = false;

    while (i < code.length) {
        const char = code[i];
        const nextChar = i + 1 < code.length ? code[i + 1] : '';

        // Handle end of single-line comment
        if (inSingleLineComment && (char === '\n' || char === '\r')) {
            inSingleLineComment = false;
            result += char; // Keep the newline
            i++;
            continue;
        }

        // Handle end of multi-line comment
        if (inMultiLineComment && char === '*' && nextChar === '/') {
            inMultiLineComment = false;
            i += 2; // Skip */
            continue;
        }

        // Skip characters inside comments
        if (inSingleLineComment || inMultiLineComment) {
            i++;
            continue;
        }

        // Handle string literals
        if (!inRegex && (char === '"' || char === "'" || char === '`')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar && code[i - 1] !== '\\') {
                inString = false;
                stringChar = '';
            }
            result += char;
            i++;
            continue;
        }

        // Skip comment detection inside strings or regex
        if (inString || inRegex) {
            result += char;
            i++;
            continue;
        }

        // Detect start of comments
        if (char === '/' && nextChar === '/') {
            inSingleLineComment = true;
            i += 2;
            continue;
        }

        if (char === '/' && nextChar === '*') {
            inMultiLineComment = true;
            i += 2;
            continue;
        }

        // Basic regex detection (simplified)
        if (char === '/' && !inString) {
            // Look for common patterns that indicate regex
            const prevNonWhitespace = result.trim().slice(-1);
            if (['=', '(', '[', ',', ':', ';', '!', '&', '|', '?', '+', '-', '*', '/', '%', '{', '}', 'return'].some(pattern => 
                result.trim().endsWith(pattern) || prevNonWhitespace === pattern)) {
                inRegex = true;
            }
        }

        if (inRegex && char === '/' && code[i - 1] !== '\\') {
            inRegex = false;
        }

        result += char;
        i++;
    }

    return result;
}

/**
 * Validates JavaScript code, handling both CommonJS and ES6 modules.
 * @param {string} code The JavaScript code to validate.
 * @param {string} filePath The file path for logging purposes.
 * @returns {boolean} True if the code is valid, false otherwise.
 */
function isValidJavaScript(code, filePath = '') {
    try {
        // First, try direct function validation for CommonJS
        new Function(code);
        return true;
    } catch (error) {
        // If it fails, check if it's because of ES6 modules
        if (error.message.includes('import') || error.message.includes('export')) {
            try {
                // For ES6 modules, we'll do a basic syntax check by transforming
                // import/export statements temporarily
                let testCode = code
                    // Replace import statements with variable declarations
                    .replace(/import\s+.*?\s+from\s+['"`].*?['"`];?/g, '// import statement')
                    .replace(/import\s+['"`].*?['"`];?/g, '// import statement')
                    // Replace export statements
                    .replace(/export\s+default\s+/g, 'const __default = ')
                    .replace(/export\s+\{[^}]*\}/g, '// export statement')
                    .replace(/export\s+(const|let|var|function|class)/g, '$1')
                    .replace(/export\s+/g, '');
                
                new Function(testCode);
                return true;
            } catch (transformError) {
                console.warn(`Skipping file ${filePath} due to syntax error:`, transformError.message);
                return false;
            }
        } else {
            console.warn(`Skipping file ${filePath} due to syntax error:`, error.message);
            return false;
        }
    }
}
function getObfuscatorOptions() {
    return {
        compact: true,
        controlFlowFlattening: true,
        deadCodeInjection: true,
        numbersToExpressions: true,
        simplify: true,
        stringArrayShuffle: true,
        splitStrings: true,
        stringArrayThreshold: 1
    };
}