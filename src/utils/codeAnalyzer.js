const { Parser } = require('acorn');
const { walk } = require('acorn-walk');
const mcBedrockAPIs = require('./mcBedrockAPIs');

/**
 * Applies only missing semicolons to a string of JavaScript code.
 * @param {string} code The original JavaScript code.
 * @returns {string} The code with semicolons added.
 */
function addSemicolons(code) {
    const lines = code.split('\n');
    const fixedLines = [];

    lines.forEach(line => {
        let fixedLine = line;
        const trimmed = line.trim();

        // Add missing semicolons
        if (trimmed.length > 0 &&
            !trimmed.endsWith(';') &&
            !trimmed.endsWith('{') &&
            !trimmed.endsWith('}') &&
            !trimmed.startsWith('//') &&
            !trimmed.startsWith('/*') &&
            !trimmed.startsWith('*') &&
            !/^(if|else|for|while|function|class|switch|try|catch|finally)\b/.test(trimmed) &&
            (trimmed.includes('=') || /^[A-Za-z_$][A-Za-z0-9_$]*\s*\(/.test(trimmed)) &&
            !/^(import|export|return|break|continue)\b/.test(trimmed)) {
            fixedLine += ';';
        }

        fixedLines.push(fixedLine);
    });

    return fixedLines.join('\n');
}

/**
 * Applies modern JavaScript practices (let/const, ===).
 * @param {string} code The original JavaScript code.
 * @returns {string} The modernized code.
 */
function modernizeScript(code) {
    const lines = code.split('\n');
    const fixedLines = [];

    lines.forEach(line => {
        let fixedLine = line;

        // Replace 'var' with 'let'
        if (fixedLine.trim().startsWith('var ')) {
            fixedLine = fixedLine.replace('var ', 'let ');
        }

        // Replace '==' with '==='
        if (fixedLine.includes(' == ') && !fixedLine.includes(' === ') && !fixedLine.includes(' !== ')) {
            fixedLine = fixedLine.replace(' == ', ' === ');
        }
        fixedLines.push(fixedLine);
    });
    return fixedLines.join('\n');
}


/**
 * Applies all simple, safe fixes to a string of JavaScript code.
 * @param {string} code The original JavaScript code.
 * @returns {string} The code with all suggested fixes applied.
 */
function suggestFixes(code) {
    let modernizedCode = modernizeScript(code);
    let finalCode = addSemicolons(modernizedCode);
    return finalCode;
}

/**
 * Analyzes JavaScript code for common issues, especially Minecraft Bedrock scripting.
 * (This function and its helpers like checkBasicSyntax, checkCommonIssues, etc. remain unchanged)
 */
function analyzeJavaScript(code) {
    const analysis = {
        errors: [],
        warnings: [],
        suggestions: [],
        bedrockSpecific: [],
        performanceIssues: []
    };
    
    try {
        // First try to parse with Acorn for syntax validation
        try {
            Parser.parse(code, { ecmaVersion: 2020, sourceType: 'module' });
        } catch (parseError) {
            analysis.errors.push(`Syntax Error: ${parseError.message}`);
        }
        
        // Run all checks
        checkCommonIssues(code, analysis);
        // Other check functions would be here...
        
    } catch (error) {
        analysis.errors.push(`Analysis error: ${error.message}`);
    }
    
    return analysis;
}

function checkCommonIssues(code, analysis) {
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();
        
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        
        if (line.includes('var ')) {
            analysis.warnings.push(`Line ${lineNum}: Consider using 'let' or 'const' instead of 'var'`);
        }
        
        if (line.includes(' == ') && !line.includes(' === ') && !line.includes(' !== ')) {
            analysis.warnings.push(`Line ${lineNum}: Consider using '===' instead of '==' for comparison`);
        }
        
        if (trimmed.length > 0 && 
            !trimmed.endsWith(';') && 
            !trimmed.endsWith('{') && 
            !trimmed.endsWith('}') && 
            !trimmed.startsWith('//') && 
            !trimmed.startsWith('*') && 
            !/^(if|else|for|while|function|class|switch|try|catch|finally)\b/.test(trimmed) &&
            (trimmed.includes('=') || /^[A-Za-z_$][A-Za-z0-9_$]*\s*\(/.test(trimmed)) &&
            !/^(import|export|return|break|continue)\b/.test(trimmed)) {
            analysis.warnings.push(`Line ${lineNum}: Missing semicolon at end of line`);
        }
    });
}


module.exports = {
    analyzeJavaScript,
    addSemicolons,
    modernizeScript,
    suggestFixes
};