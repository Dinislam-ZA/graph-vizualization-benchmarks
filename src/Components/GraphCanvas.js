import React, { useRef, useEffect, useState } from 'react';

const GraphCanvas = ({ nodes, edges, setNodes }) => {
    const canvasRef = useRef(null);
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [draggingNode, setDraggingNode] = useState(null);  // Перетаскиваемый узел

    // Определяем переменные, чтобы использовать их везде
    let graphScale = 1;
    let xOffset = 0;
    let yOffset = 0;

    // Функции для трансформации координат
    const transformX = x => x * graphScale + xOffset + offset.x;
    const transformY = y => y * graphScale + yOffset + offset.y;
    const inverseTransformX = x => (x - offset.x - xOffset) / graphScale;
    const inverseTransformY = y => (y - offset.y - yOffset) / graphScale;


    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Очистка canvas перед рендерингом
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Если нет узлов, ничего не рисуем
        if (nodes.length === 0) return;

        // Находим минимальные и максимальные координаты узлов
        const minX = Math.min(...nodes.map(node => node.x));
        const maxX = Math.max(...nodes.map(node => node.x));
        const minY = Math.min(...nodes.map(node => node.y));
        const maxY = Math.max(...nodes.map(node => node.y));

        // Определяем размеры canvas и границы для масштабирования
        const padding = 20; // Отступ от краев
        const width = canvas.width - 2 * padding;
        const height = canvas.height - 2 * padding;

        // Вычисляем коэффициенты масштабирования, чтобы граф вписался в canvas
        const scaleX = width / (maxX - minX);
        const scaleY = height / (maxY - minY);
        graphScale = Math.min(scaleX, scaleY); // Используем минимальный масштаб для сохранения пропорций

        // Центрируем граф в canvas
        xOffset = (canvas.width - (maxX - minX) * graphScale) / 2 - minX * graphScale;
        yOffset = (canvas.height - (maxY - minY) * graphScale) / 2 - minY * graphScale;

        // Рисуем рёбра
        edges.forEach(({ source, target }) => {
            const sourceNode = nodes.find(node => node.id === source);
            const targetNode = nodes.find(node => node.id === target);
            
            context.beginPath();
            context.moveTo(transformX(sourceNode.x), transformY(sourceNode.y));
            context.lineTo(transformX(targetNode.x), transformY(targetNode.y));
            context.strokeStyle = '#aaa';
            context.lineWidth = 2;
            context.stroke();
        });

        // Рисуем узлы
        const nodeRadius = 10 * scale;
        nodes.forEach(node => {
            context.beginPath();
            context.arc(transformX(node.x), transformY(node.y), nodeRadius, 0, 2 * Math.PI);
            context.fillStyle = '#0074D9';
            context.fill();
            context.strokeStyle = '#fff';
            context.lineWidth = 2;
            context.stroke();

            // Отрисовываем метку узла
            context.font = `${12 * scale}px Arial`;
            context.fillStyle = '#fff';
            context.textAlign = 'center';
            context.fillText(node.id, transformX(node.x), transformY(node.y) - 15 * scale);
        });
    }, [nodes, edges, offset, scale]);

    // Функции для обработки событий мыши
    const handleMouseDown = (event) => {
        const canvas = canvasRef.current;
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - canvasRect.left;
        const mouseY = event.clientY - canvasRect.top;
    
        // Проверка, попали ли мы в узел
        const clickedNode = nodes.find(node => {
            const transformedX = transformX(node.x);
            const transformedY = transformY(node.y);
            return Math.hypot(transformedX - mouseX, transformedY - mouseY) <= 10 * scale;
        });
    
        if (clickedNode) {
            setDraggingNode(clickedNode); // Устанавливаем перетаскиваемый узел
        } else {
            setIsPanning(true);
            setStartPan({ x: event.clientX, y: event.clientY });
        }
    };    

    const handleMouseMove = (event) => {
        const canvas = canvasRef.current;
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - canvasRect.left;
        const mouseY = event.clientY - canvasRect.top;
    
        if (draggingNode) {
            // Обновляем координаты перетаскиваемого узла
            const updatedNodes = nodes.map(node => {
                if (node.id === draggingNode.id) {
                    return {
                        ...node,
                        x: inverseTransformX(mouseX),
                        y: inverseTransformY(mouseY),
                    };
                }
                return node;
            });
    
            setNodes(updatedNodes); // Обновляем состояние
        } else if (isPanning) {
            const dx = event.clientX - startPan.x;
            const dy = event.clientY - startPan.y;
            setStartPan({ x: event.clientX, y: event.clientY });
            setOffset(prevOffset => ({ x: prevOffset.x + dx, y: prevOffset.y + dy }));
        }
    };    

    const handleMouseUp = () => {
        setIsPanning(false);
        setDraggingNode(null); // Перетаскивание узла завершено
    };

    const handleWheel = (event) => {
        event.preventDefault();
    
        const canvas = canvasRef.current;
        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - canvasRect.left;
        const mouseY = event.clientY - canvasRect.top;
    
        const zoomFactor = 1.1;
        const scaleChange = event.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
    
        // Новые значения масштаба
        const newScale = Math.max(0.1, scale * scaleChange);
    
        // Корректируем смещение для сохранения позиции мыши в одном месте
        const mouseGraphX = (mouseX - offset.x - xOffset) / scale;
        const mouseGraphY = (mouseY - offset.y - yOffset) / scale;
    
        const newOffsetX = mouseX - mouseGraphX * newScale - xOffset;
        const newOffsetY = mouseY - mouseGraphY * newScale - yOffset;
    
        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };    

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{ border: '1px solid #ddd' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        />
    );
};

export default GraphCanvas;
