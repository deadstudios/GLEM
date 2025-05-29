// src/utils/codeAnalyzer.js

/**
 * Analyzes JavaScript code for common issues, especially Minecraft Bedrock scripting
 */
function analyzeJavaScript(code) {
    const analysis = {
        errors: [],
        warnings: [],
        suggestions: [],
        bedrockSpecific: []
    };
    
    // Basic syntax checks
    try {
        // Check for basic syntax issues
        checkBasicSyntax(code, analysis);
        checkCommonIssues(code, analysis);
        checkBedrockSpecific(code, analysis);
        checkBestPractices(code, analysis);
    } catch (error) {
        analysis.errors.push(`Analysis error: ${error.message}`);
    }
    
    return analysis;
}

function checkBasicSyntax(code, analysis) {
    // Check for unmatched brackets/braces/parentheses
    const brackets = { '(': ')', '[': ']', '{': '}' };
    const stack = [];
    const lines = code.split('\n');
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        let inString = false;
        let stringChar = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            // Handle strings
            if ((char === '"' || char === "'" || char === '`') && !inString) {
                inString = true;
                stringChar = char;
                continue;
            } else if (char === stringChar && inString && line[i-1] !== '\\') {
                inString = false;
                stringChar = '';
                continue;
            }
            
            if (!inString) {
                if (brackets[char]) {
                    stack.push({ char, line: lineNum + 1, expected: brackets[char] });
                } else if (Object.values(brackets).includes(char)) {
                    if (stack.length === 0) {
                        analysis.errors.push(`Unmatched '${char}' on line ${lineNum + 1}`);
                    } else {
                        const last = stack.pop();
                        if (last.expected !== char) {
                            analysis.errors.push(`Mismatched brackets: expected '${last.expected}' but found '${char}' on line ${lineNum + 1}`);
                        }
                    }
                }
            }
        }
    }
    
    // Check for unclosed brackets
    if (stack.length > 0) {
        stack.forEach(item => {
            analysis.errors.push(`Unclosed '${item.char}' starting on line ${item.line}`);
        });
    }
}

function checkCommonIssues(code, analysis) {
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // Check for common JavaScript issues
        if (line.includes('var ')) {
            analysis.warnings.push(`Line ${lineNum}: Consider using 'let' or 'const' instead of 'var'`);
        }
        
        if (line.includes(' = ') && !line.includes('===') && !line.includes('!==') && line.includes('==')) {
            analysis.warnings.push(`Line ${lineNum}: Consider using '===' instead of '==' for comparison`);
        }
        
        if (line.includes('console.log') && !line.trim().startsWith('//')) {
            analysis.suggestions.push(`Line ${lineNum}: Remember to remove console.log statements in production`);
        }
        
        // Check for missing semicolons (basic check)
        const trimmed = line.trim();
        if (trimmed.length > 0 && 
            !trimmed.endsWith(';') && 
            !trimmed.endsWith('{') && 
            !trimmed.endsWith('}') && 
            !trimmed.startsWith('//') && 
            !trimmed.startsWith('*') && 
            !trimmed.includes('if ') &&
            !trimmed.includes('else') &&
            !trimmed.includes('for ') &&
            !trimmed.includes('while ') &&
            !trimmed.includes('function ') &&
            trimmed.includes('=')) {
            analysis.warnings.push(`Line ${lineNum}: Missing semicolon`);
        }
    });
}

function checkBedrockSpecific(code, analysis) {
    // Check for common Bedrock scripting patterns and issues
    
    if (code.includes('@minecraft/server')) {
        analysis.bedrockSpecific.push('Detected Minecraft Bedrock server module usage');
        
        // Check for proper imports
        if (!code.includes('import') && code.includes('@minecraft/server')) {
            analysis.errors.push('Missing import statement for @minecraft/server module');
        }
    }
    
    if (code.includes('world.') || code.includes('World.')) {
        analysis.bedrockSpecific.push('World API usage detected');
    }
    
    if (code.includes('player.') || code.includes('Player.')) {
        analysis.bedrockSpecific.push('Player API usage detected');
    }
    
    // Check for event handling
    if (code.includes('.subscribe') || code.includes('addEventListener')) {
        analysis.bedrockSpecific.push('Event handling detected - ensure proper cleanup');
    }
    
    // Check for tick events
    if (code.includes('tick') || code.includes('Tick')) {
        analysis.warnings.push('Tick events detected - be mindful of performance impact');
    }
    
    // Check for component usage
    if (code.includes('getComponent') || code.includes('hasComponent')) {
        analysis.bedrockSpecific.push('Component system usage detected');
    }
    
    // Check for dimension usage
    if (code.includes('dimension') || code.includes('Dimension')) {
        analysis.bedrockSpecific.push('Dimension API usage detected');
    }
}

function checkBestPractices(code, analysis) {
    // Check for error handling
    if (code.includes('try') && !code.includes('catch')) {
        analysis.warnings.push('Try block found without catch - ensure proper error handling');
    }
    
    // Check for async/await usage
    if (code.includes('async') && !code.includes('await')) {
        analysis.warnings.push('Async function declared but no await found - verify if needed');
    }
    
    // Check for undefined variables (basic check)
    const lines = code.split('\n');
    const definedVars = new Set();
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        
        // Find variable declarations
        const varDeclarations = line.match(/(?:let|const|var)\s+(\w+)/g);
        if (varDeclarations) {
            varDeclarations.forEach(decl => {
                const varName = decl.split(/\s+/)[1];
                definedVars.add(varName);
            });
        }
        
        // Check function parameters
        const funcMatch = line.match(/function\s+\w+\s*\(([^)]*)\)/);
        if (funcMatch && funcMatch[1]) {
            const params = funcMatch[1].split(',').map(p => p.trim().split(' ')[0]);
            params.forEach(param => definedVars.add(param));
        }
    });
    
    // Performance suggestions
    if (code.includes('setInterval') || code.includes('setTimeout')) {
        analysis.suggestions.push('Using timers detected - consider using Minecraft\'s tick system for better performance');
    }
    
    if (code.split('for (').length > 3) {
        analysis.suggestions.push('Multiple loops detected - consider optimizing for performance');
    }
}

module.exports = {
    analyzeJavaScript
};