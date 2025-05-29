const { Parser } = require('acorn');
const { walk } = require('acorn-walk');
const mcBedrockAPIs = require('./mcBedrockAPIs');

/**
 * Analyzes JavaScript code for common issues, especially Minecraft Bedrock scripting
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
        checkBasicSyntax(code, analysis);
        checkCommonIssues(code, analysis);
        checkBedrockSpecific(code, analysis);
        checkBestPractices(code, analysis);
        checkPerformance(code, analysis);
        
        // AST-based checks if parsing succeeded
        if (analysis.errors.length === 0 || analysis.errors.every(e => !e.startsWith('Syntax Error'))) {
            try {
                const ast = Parser.parse(code, { ecmaVersion: 2020, sourceType: 'module' });
                checkAST(ast, analysis);
            } catch (e) {
                // Ignore AST parsing errors if we already have syntax errors
            }
        }
        
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
        let inComment = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i+1];
            
            // Handle comments
            if (!inString && char === '/' && nextChar === '/') {
                break;
            }
            if (!inString && char === '/' && nextChar === '*') {
                inComment = true;
                i++;
                continue;
            }
            if (inComment && char === '*' && nextChar === '/') {
                inComment = false;
                i++;
                continue;
            }
            if (inComment) continue;
            
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
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        
        // Check for common JavaScript issues
        if (line.includes('var ')) {
            analysis.warnings.push(`Line ${lineNum}: Consider using 'let' or 'const' instead of 'var'`);
        }
        
        if (line.includes(' == ') && !line.includes(' === ') && !line.includes(' !== ')) {
            analysis.warnings.push(`Line ${lineNum}: Consider using '===' instead of '==' for comparison`);
        }
        
        if (line.includes('console.log') && !line.trim().startsWith('//')) {
            analysis.suggestions.push(`Line ${lineNum}: Remember to remove console.log statements in production`);
        }
        
        // Check for missing semicolons (more accurate check)
        if (trimmed.length > 0 && 
            !trimmed.endsWith(';') && 
            !trimmed.endsWith('{') && 
            !trimmed.endsWith('}') && 
            !trimmed.startsWith('//') && 
            !trimmed.startsWith('*') && 
            !/^(if|else|for|while|function|class|switch|try|catch|finally)\b/.test(trimmed) &&
            !/^[A-Za-z_$][A-Za-z0-9_$]*\s*\(/.test(trimmed) && // Function calls
            !/^(import|export|return|break|continue)\b/.test(trimmed) &&
            trimmed.includes('=')) {
            analysis.warnings.push(`Line ${lineNum}: Missing semicolon at end of line`);
        }
    });
}

function checkBedrockSpecific(code, analysis) {
    // Check for common Bedrock scripting patterns and issues
    
    // Check for module imports
    const importRegex = /import\s*{([^}]+)}\s*from\s*['"](@minecraft\/[^'"]+)['"]/g;
    let match;
    const importedModules = new Set();
    
    while ((match = importRegex.exec(code)) !== null) {
        const moduleName = match[2];
        importedModules.add(moduleName);
        
        if (moduleName === '@minecraft/server') {
            analysis.bedrockSpecific.push(`Imported Minecraft server module: ${match[1]}`);
        }
    }
    
    // Check for usage of Minecraft APIs without imports
    const mcApis = Object.keys(mcBedrockAPIs);
    mcApis.forEach(api => {
        if (code.includes(api) && !Array.from(importedModules).some(m => mcBedrockAPIs[api].includes(m))) {
            analysis.errors.push(`Using '${api}' without importing required module. Needed modules: ${mcBedrockAPIs[api].join(', ')}`);
        }
    });
    
    // Check for common Bedrock API usage
    if (code.includes('world.')) {
        analysis.bedrockSpecific.push('World API usage detected - ensure proper permissions');
    }
    
    if (code.includes('system.')) {
        analysis.bedrockSpecific.push('System API usage detected - be careful with system operations');
    }
    
    // Check for event handling
    if (code.includes('.subscribe(') || code.includes('system.events.')) {
        analysis.bedrockSpecific.push('Event subscription detected - ensure proper cleanup with .unsubscribe()');
    }
    
    // Check for tick events
    if (code.includes('tick') || code.includes('system.runInterval')) {
        analysis.warnings.push('Tick-based events detected - be mindful of performance impact');
        analysis.suggestions.push('Consider using event-based approaches instead of ticks when possible');
    }
    
    // Check for deprecated APIs
    const deprecatedAPIs = [
        'entity.rideable',
        'player.spawn',
        'world.getPlayers'
    ];
    
    deprecatedAPIs.forEach(api => {
        if (code.includes(api)) {
            analysis.warnings.push(`Deprecated API usage: ${api} - consider updating to newer alternatives`);
        }
    });
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
    
    // Check for proper event cleanup
    if (code.includes('.subscribe(') && !code.includes('.unsubscribe(')) {
        analysis.warnings.push('Event subscription detected but no unsubscribe found - potential memory leak');
    }
}

function checkPerformance(code, analysis) {
    const lines = code.split('\n');
    let loopCount = 0;
    
    lines.forEach(line => {
        // Count loops
        if (line.includes('for (') || line.includes('while (') || line.includes('system.runInterval')) {
            loopCount++;
        }
        
        // Check for expensive operations
        if (line.includes('getEntities') || line.includes('getPlayers')) {
            analysis.performanceIssues.push('Potential performance issue: Getting all entities/players can be expensive');
        }
    });
    
    if (loopCount > 3) {
        analysis.suggestions.push(`Multiple loops detected (${loopCount}) - consider optimizing for performance`);
    }
    
    if (code.includes('JSON.parse') || code.includes('JSON.stringify')) {
        analysis.performanceIssues.push('JSON parsing/stringifying detected - can be expensive in tight loops');
    }
}

function checkAST(ast, analysis) {
    const usedVariables = new Set();
    const declaredVariables = new Set();
    const subscribedEvents = new Set();
    const requiredBedrockAPIs = new Set();
    const dynamicProperties = new Set();

    walk.simple(ast, {
        VariableDeclarator(node) {
            if (node.id.type === 'Identifier') {
                declaredVariables.add(node.id.name);
            }
        },

        Identifier(node) {
            // Track variable usage
            if (!declaredVariables.has(node.name) && !usedVariables.has(node.name)) {
                usedVariables.add(node.name);
            }
        },

        ImportDeclaration(node) {
            // Track Minecraft module imports
            if (node.source.value.startsWith('@minecraft/')) {
                node.specifiers.forEach(spec => {
                    if (spec.type === 'ImportSpecifier') {
                        requiredBedrockAPIs.add(spec.imported.name);
                    }
                });
            }
        },

        CallExpression(node) {
            // Check for Minecraft API calls
            if (node.callee.type === 'MemberExpression') {
                const objectName = node.callee.object.name;
                const propertyName = node.callee.property.name;

                // Detect event subscriptions
                if (propertyName === 'subscribe') {
                    subscribedEvents.add(`${objectName}.${propertyName}`);
                    analysis.bedrockSpecific.push(`Event subscription detected: ${objectName}.${propertyName}`);
                }

                // Detect command execution
                if (propertyName === 'runCommand') {
                    analysis.warnings.push(`Direct command execution detected: ${objectName}.${propertyName} - consider using API methods instead`);
                }

                // Detect dynamic property usage
                if (propertyName === 'getDynamicProperty' || propertyName === 'setDynamicProperty') {
                    dynamicProperties.add(objectName);
                }
            }

            // Detect tick-based operations
            if (node.callee.type === 'MemberExpression' &&
                node.callee.object.name === 'system' &&
                (node.callee.property.name === 'run' || node.callee.property.name === 'runInterval')) {
                analysis.performanceIssues.push(`System tick operation detected: ${node.callee.property.name} - may impact performance`);
            }
        },

        MemberExpression(node) {
            // Check for common Bedrock API patterns
            if (node.object.name === 'world' || node.object.name === 'World') {
                analysis.bedrockSpecific.push(`World API usage detected: ${node.object.name}.${node.property.name}`);
            }

            if (node.object.name === 'player' || node.object.name === 'Player') {
                analysis.bedrockSpecific.push(`Player API usage detected: ${node.object.name}.${node.property.name}`);
            }
        },

        TryStatement(node) {
            // Check for proper error handling in try-catch
            if (node.handler && node.handler.param) {
                const errorParam = node.handler.param.name;
                let usesErrorParam = false;

                walk.simple(node.handler.body, {
                    Identifier(n) {
                        if (n.name === errorParam) {
                            usesErrorParam = true;
                        }
                    }
                });

                if (!usesErrorParam) {
                    analysis.warnings.push(`Unused error parameter '${errorParam}' in catch block - consider logging or handling the error`);
                }
            }
        },

        FunctionDeclaration(node) {
            // Check for async functions without await
            if (node.async) {
                let hasAwait = false;

                walk.simple(node.body, {
                    AwaitExpression() {
                        hasAwait = true;
                    }
                });

                if (!hasAwait) {
                    analysis.warnings.push(`Async function '${node.id.name}' declared but contains no await expressions`);
                }
            }
        },

        ForStatement(node) {
            // Check for expensive operations in loops
            walk.simple(node.body, {
                CallExpression(n) {
                    if (n.callee.type === 'MemberExpression' &&
                        (n.callee.property.name === 'getEntities' || 
                         n.callee.property.name === 'getPlayers')) {
                        analysis.performanceIssues.push(`Potential performance issue: ${n.callee.property.name} called inside loop`);
                    }
                }
            });
        }
    });

    // Post-walk analysis
    Array.from(usedVariables).forEach(varName => {
        if (!declaredVariables.has(varName) && 
            !requiredBedrockAPIs.has(varName) &&
            !mcBedrockAPIs[varName]) {
            analysis.errors.push(`Possible undefined variable: ${varName}`);
        }
    });

    // Check for unsubscribed events
    if (subscribedEvents.size > 0) {
        let hasUnsubscribe = false;
        walk.simple(ast, {
            CallExpression(node) {
                if (node.callee.type === 'MemberExpression' &&
                    node.callee.property.name === 'unsubscribe') {
                    hasUnsubscribe = true;
                }
            }
        });

        if (!hasUnsubscribe) {
            analysis.warnings.push(`Event subscriptions detected but no unsubscribe calls found - potential memory leak`);
        }
    }

    // Check for dynamic property usage without type checking
    dynamicProperties.forEach(obj => {
        analysis.suggestions.push(`Dynamic property used on ${obj} - consider adding type checking for safety`);
    });
}

module.exports = {
    analyzeJavaScript
};