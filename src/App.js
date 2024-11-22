import React, { useState, useEffect } from 'react';
import { encode, decode } from '@msgpack/msgpack';
import GraphCanvas from './Components/GraphCanvas';
import GraphWebGL from './Components/GraphWebGL'; // Импортируем компонент для WebGL

function App() {
    // Состояние для узлов и рёбер
    const [nodes, setNodes] = useState([
        { id: 'A' }, 
        { id: 'B' }, 
        { id: 'C' },
        { id: 'F' },
    ]);
    const [edges, setEdges] = useState([
        { source: 'A', target: 'B' },
        { source: 'A', target: 'C' },
        { source: 'A', target: 'F' },
        { source: 'F', target: 'C' },
    ]);

    // Состояние для переключения между Canvas и WebGL
    const [mode, setMode] = useState('canvas');

    // Функция для отправки графа на сервер и получения данных с координатами
    const sendGraphData = async () => {
        try {
            // Формируем данные для отправки
            const graphData = { nodes, edges };

            // Кодируем данные в MessagePack
            const encodedData = encode(graphData);

            // Отправляем данные на сервер
            const response = await fetch('http://127.0.0.1:8000/graph/layout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-msgpack',
                    'Accept': 'application/x-msgpack',
                },
                body: encodedData,
            });

            if (response.ok) {
                // Декодируем данные из MessagePack
                const arrayBuffer = await response.arrayBuffer();
                const graphResponse = decode(new Uint8Array(arrayBuffer));

                // Обновляем состояние узлов и рёбер с координатами
                setNodes(graphResponse.nodes);
                setEdges(graphResponse.edges);
            } else {
                console.error('Ошибка при отправке данных графа на сервер');
            }
        } catch (error) {
            console.error('Ошибка при отправке данных графа:', error);
        }
    };

    // Загружаем данные с сервера при монтировании компонента
    useEffect(() => {
        sendGraphData();
    }, []);

    return (
        <div className="app-container">
            <h1>Graph Visualization</h1>

            {/* Кнопки для переключения между Canvas и WebGL */}
            <div>
                <button onClick={() => setMode('canvas')}>Canvas</button>
                <button onClick={() => setMode('webgl')}>WebGL</button>
            </div>

            {/* Отображаем нужный компонент в зависимости от выбранного режима */}
            {mode === 'canvas' ? (
                <GraphCanvas nodes={nodes} edges={edges} setNodes={setNodes} />
            ) : (
                <GraphWebGL nodes={nodes} edges={edges} setNodes={setNodes} />
            )}
        </div>
    );
}

export default App;
