import React, { useRef, useEffect, useState } from 'react';

const GraphWebGL = ({ nodes, edges, setNodes }) => {
    const canvasRef = useRef(null);

    const [scale, setScale] = useState(1); // Масштаб
    const [offset, setOffset] = useState({ x: 0, y: 0 }); // Смещение
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 }); // Последняя позиция мыши
    const [isPanning, setIsPanning] = useState(false); // Для панорамирования
    const [draggingNode, setDraggingNode] = useState(null); // Узел, который перемещается

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas.getContext('webgl');

        if (!gl) {
            console.error('WebGL не поддерживается данным браузером.');
            return;
        }

        // Шейдеры
        const vertexShaderSource = `
            attribute vec2 a_position;
            uniform vec2 u_offset;
            uniform float u_scale;

            void main() {
                vec2 scaledPosition = (a_position * u_scale) + u_offset;
                gl_Position = vec4(scaledPosition, 0, 1);
                gl_PointSize = 10.0 * u_scale;
            }
        `;
        const fragmentShaderSourceEdges = `
            precision mediump float;
            void main() {
                gl_FragColor = vec4(0.6, 0.6, 0.6, 1.0); // Серый цвет для рёбер
            }
        `;
        const fragmentShaderSourceNodes = `
            precision mediump float;
            void main() {
                vec2 coords = gl_PointCoord - vec2(0.5); // Центр координат точки
                float dist = length(coords); // Расстояние от центра
                if (dist > 0.5) {
                    discard; // Отбрасываем пиксели за пределами круга
                }
                gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0); // Синий цвет для узлов
            }
        `;

        const createShader = (type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const createProgram = (vertexShaderSource, fragmentShaderSource) => {
            const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error(gl.getProgramInfoLog(program));
                gl.deleteProgram(program);
                return null;
            }
            return program;
        };

        const programEdges = createProgram(vertexShaderSource, fragmentShaderSourceEdges);
        const programNodes = createProgram(vertexShaderSource, fragmentShaderSourceNodes);

        // Буфер вершин
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        const drawScene = () => {
            gl.clear(gl.COLOR_BUFFER_BIT);

            const drawEdges = () => {
                gl.useProgram(programEdges);

                const positionAttribute = gl.getAttribLocation(programEdges, 'a_position');
                const offsetUniform = gl.getUniformLocation(programEdges, 'u_offset');
                const scaleUniform = gl.getUniformLocation(programEdges, 'u_scale');

                const edgePositions = edges.flatMap(edge => {
                    const source = nodes.find(node => node.id === edge.source);
                    const target = nodes.find(node => node.id === edge.target);
                    return [source.x, source.y, target.x, target.y];
                });
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgePositions), gl.STATIC_DRAW);

                gl.uniform2f(offsetUniform, offset.x, offset.y);
                gl.uniform1f(scaleUniform, scale);

                gl.enableVertexAttribArray(positionAttribute);
                gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

                gl.drawArrays(gl.LINES, 0, edges.length * 2);
            };

            const drawNodes = () => {
                gl.useProgram(programNodes);

                const positionAttribute = gl.getAttribLocation(programNodes, 'a_position');
                const offsetUniform = gl.getUniformLocation(programNodes, 'u_offset');
                const scaleUniform = gl.getUniformLocation(programNodes, 'u_scale');

                const nodePositions = nodes.flatMap(node => [node.x, node.y]);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nodePositions), gl.STATIC_DRAW);

                gl.uniform2f(offsetUniform, offset.x, offset.y);
                gl.uniform1f(scaleUniform, scale);

                gl.enableVertexAttribArray(positionAttribute);
                gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

                gl.drawArrays(gl.POINTS, 0, nodes.length);
            };

            drawEdges();
            drawNodes();
        };

        drawScene();

        const cleanup = () => {
            gl.deleteBuffer(positionBuffer);
            gl.deleteProgram(programEdges);
            gl.deleteProgram(programNodes);
        };

        return cleanup;
    }, [nodes, edges, scale, offset]);

    // Преобразование координат мыши в координаты графа
    const getGraphCoordinates = (mouseX, mouseY) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const normalizedX = ((mouseX - rect.left) / rect.width) * 2 - 1;
        const normalizedY = -(((mouseY - rect.top) / rect.height) * 2 - 1);
        const graphX = (normalizedX - offset.x) / scale;
        const graphY = (normalizedY - offset.y) / scale;
        return { x: graphX, y: graphY };
    };

    // Обработчики событий
    const handleMouseDown = (event) => {
        const { x, y } = getGraphCoordinates(event.clientX, event.clientY);

        const clickedNode = nodes.find(node =>
            Math.hypot(node.x - x, node.y - y) < 0.05
        );

        if (clickedNode) {
            setDraggingNode(clickedNode);
        } else {
            setIsPanning(true);
            setLastMousePos({ x: event.clientX, y: event.clientY });
        }
    };

    const handleMouseMove = (event) => {
        if (draggingNode) {
            const { x, y } = getGraphCoordinates(event.clientX, event.clientY);

            setNodes(nodes.map(node =>
                node.id === draggingNode.id ? { ...node, x, y } : node
            ));
        } else if (isPanning) {
            const dx = event.clientX - lastMousePos.x;
            const dy = event.clientY - lastMousePos.y;

            setOffset(prev => ({
                x: prev.x + (dx / canvasRef.current.width) * 2,
                y: prev.y - (dy / canvasRef.current.height) * 2,
            }));

            setLastMousePos({ x: event.clientX, y: event.clientY });
        }
    };

    const handleMouseUp = () => {
        setDraggingNode(null);
        setIsPanning(false);
    };

    const handleWheel = (event) => {
        event.preventDefault();

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

        const zoomFactor = 1.1;
        const scaleChange = event.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
        const newScale = Math.max(0.1, scale * scaleChange);

        const graphX = (mouseX - offset.x) / scale;
        const graphY = (mouseY - offset.y) / scale;

        const newOffsetX = mouseX - graphX * newScale;
        const newOffsetY = mouseY - graphY * newScale;

        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{ border: '1px solid black' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        />
    );
};

export default GraphWebGL;
