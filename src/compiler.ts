/* Step 1. Tokenize */
const WHITESPACE = /\s/;
const NUMBERS = /[0-9]/;
const LETTERS = /[A-Za-z]/;

type Token = {
    type: string,
    value: string
}

const tokenizer = (input: string): Token[] => {

    let tokens: Token[] = [];
    let curr = 0;

    while (curr < input.length) {

        let char = input[curr];
        let token: Token;


        // if current char is parenthesis
        if (char === '(' || char === ')') {
            token = {
                type: 'parenthesis',
                value: char
            }
            tokens.push(token);

            curr++;
            continue;
        }

        // if encounter white space char
        if (WHITESPACE.test(char)) {
            curr++;
            continue;
        }

        // if current char is number
        if (NUMBERS.test(char)) {
            let value = ""

            while (NUMBERS.test(char)) {
                value += char
                char = input[++curr];
            }

            token = { type: 'number', value }
            tokens.push(token);

            continue;

        }


        // if current char is quote
        if (char === `"` || char === `'`) {
            let quote = char;
            let value = "";

            char = input[++curr];
            while (char != quote) {
                value += char;
                char = input[++curr];
            }
            char = input[++curr];


            token = { type: 'string', value }
            tokens.push(token);

            continue;
        }

        // if current char is letter 
        if (LETTERS.test(char)) {
            let value = "";

            while (LETTERS.test(char)) {
                value += char;
                char = input[++curr];
            }

            token = { type: 'name', value };
            tokens.push(token);

            continue;
        }

        throw new TypeError('Syntax error : ' + char);
    }

    return tokens;
}


/*Step 2  parse */
type ASTNode = {
    type: string,
    value?: string,
    name?: string,
    params?: ASTNode[],
    body?: ASTNode[],
    _context?: any[]
};

const parser = (tokens: Token[]): ASTNode => {
    let curr = 0;

    function walk(): ASTNode {

        let token: Token = tokens[curr];

        // convert to a NumberLiteral node
        if (token.type === "number") {

            curr++;
            return {
                type: 'NumberLiteral',
                value: token.value
            }
        }

        // convert to a stringLiteral node
        if (token.type === "string") {

            curr++;
            return {
                type: 'stringLiteral',
                value: token.value
            }
        }


        // if current token is an open parenthesis
        if (token.type === "parenthesis" && token.value === "(") {

            // skip parenthesis
            token = tokens[++curr];

            // convert to a CallExpression node since the name of 
            // the function is right after open parenthesis
            let node: ASTNode = {
                type: 'CallExpression',
                name: token.value,
                params: []
            }

            token = tokens[++curr];

            // recursion until we met close parenthesis
            while (token.type !== "parenthesis" ||
                (token.type === "parenthesis" && token.value !== ")")) {
                node.params?.push(walk());
                token = tokens[curr];
            }

            // skip the close parenthesis
            curr++;

            return node;
        }

        throw new TypeError(token.type);

    }

    let ast: ASTNode = {
        type: 'Program',
        body: [],
    };

    while (curr < tokens.length) {
        ast.body?.push(walk());
    }

    return ast;
}


/*Step 3  transform */
type transFormedASTNode = Partial<ASTNode> & {
    callee?: any,
    arguments?: [],
    expression?: any
};

const visitor = {
    NumberLiteral: {
        enter(node: ASTNode, parent: ASTNode | null) {
            parent?._context?.push({
                type: 'NumberLiteral',
                value: node.value,
            });
        },
    },

    StringLiteral: {
        enter(node: ASTNode, parent: ASTNode | null) {
            parent?._context?.push({
                type: 'StringLiteral',
                value: node.value,
            });
        },
    },

    CallExpression: {
        enter(node: ASTNode, parent: ASTNode) {

            let expression: transFormedASTNode = {
                type: 'CallExpression',
                callee: {
                    type: 'Identifier',
                    name: node.name,
                },
                arguments: []
            };

            // define a new context based on arguments
            node._context = expression.arguments;

            if (parent.type !== 'CallExpression') {

                expression = {
                    type: 'ExpressionStatement',
                    expression: expression,
                };
            }

            parent._context?.push(expression);
        }
    }
}

// traverse the ast 
const traversal = (ast: ASTNode, visitor: any) => {

    function arrayTraversal(arr: ASTNode[], parent: ASTNode | null) {
        arr.forEach(child => {
            nodeTraversal(child, parent);
        });
    }


    function nodeTraversal(node: ASTNode, parent: ASTNode | null) {

        let methods = visitor[node.type];

        if (methods?.enter) {
            methods.enter(node, parent);
        }

        switch (node.type) {
            case "Program":
                arrayTraversal(node.body!, node);
                break;
            case "CallExpression":
                arrayTraversal(node.params!, node);
                break;
            case 'NumberLiteral':
            case 'StringLiteral':
                break;
            default:
                throw new TypeError(node.type);
        }

        if (methods?.exit) {
            methods.exit(node, parent);
        }
    }

    // traversal from ast root, so there is no parent
    nodeTraversal(ast, null);
}


// from ast to new AST
const transform = (ast: ASTNode) => {
    let newAST: transFormedASTNode = {
        type: 'Program',
        body: [],
    }

    // the context is a reference to newAST
    ast._context = newAST.body;
    // traverse the ast and transform with visitor method
    traversal(ast, visitor);
    return newAST;
}

/*Step 4  Code generation */
const codeGenerator = (node: transFormedASTNode): any => {

    switch (node.type) {

        case 'Program':
            return node.body!.map(codeGenerator)
                .join('\n');

        case 'ExpressionStatement':
            return (
                codeGenerator(node.expression) + ';'
            );


        case 'CallExpression':
            return (
                codeGenerator(node.callee) +
                '(' +
                node.arguments!.map(codeGenerator)
                    .join(', ') +
                ')'
            );

        case 'Identifier':
            return node.name;

        case 'NumberLiteral':
            return node.value;

        case 'StringLiteral':
            return '"' + node.value + '"';

        default:
            throw new TypeError(node.type);
    }
}


function compile (input: string) : string {
    return codeGenerator(transform(parser(tokenizer(input))));
}

export default compile;