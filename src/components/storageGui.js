import React from 'react';
import { useState, useEffect } from 'react';

const StorageGUI = () => {
    const warehouseID = 1;
    const [warehouseInventory, setWarehouseInventory] = useState([]);
    const [selectedShelf, setSelectedShelf] = useState(null);
    const [hardCodeLayout, setHardCodeLayout] = useState({
        "grid-dim": [10, 10],
        "shelves": [
            {
                "id": 1,
                "btm-lft": [0, 1],
                "dim": [4, 2],
                "capacity": 10,
                "current": 0,
                "name": "Shelf A1",
                "category": "Electronics"
            },
            {
                "id": 2,
                "btm-lft": [0, 4],
                "dim": [4, 2],
                "capacity": 10,
                "current": 0,
                "name": "Shelf A2",
                "category": "Clothing"
            },
            {
                "id": 3,
                "btm-lft": [0, 7],
                "dim": [4, 2],
                "capacity": 10,
                "current": 0,
                "name": "Shelf A3",
                "category": "Food"
            },
            {
                "id": 4,
                "btm-lft": [6, 1],
                "dim": [4, 2],
                "capacity": 10,
                "current": 0,
                "name": "Shelf B1",
                "category": "Furniture"
            },
            {
                "id": 5,
                "btm-lft": [6, 4],
                "dim": [4, 2],
                "capacity": 10,
                "current": 0,
                "name": "Shelf B2",
                "category": "Tools"
            },
            {
                "id": 6,
                "btm-lft": [6, 7],
                "dim": [4, 2],
                "capacity": 10,
                "current": 0,
                "name": "Shelf B3",
                "category": "Miscellaneous"
            },
        ]
    });

    useEffect(() => {
        console.log(warehouseInventory);
        const shelfCapacity = warehouseInventory.reduce((acc, item) => {
            const key = item.shelf_id;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        console.log(shelfCapacity);
        const tempLayout = {
            "grid-dim": hardCodeLayout["grid-dim"],
            "shelves": hardCodeLayout.shelves.map((shelf) => {
                return {
                    ...shelf,
                    "current": shelfCapacity[shelf.id] || 0,
                };
            }),
        };
        setHardCodeLayout(tempLayout);
    }, [warehouseInventory]);

    useEffect(() => {
        fetch('/api/getInventory', {
            method: 'GET',
        })
            .then((res) => {
                if (!res.ok) {
                    throw new Error('Network response was not ok');
                }
                return res.json();
            }).then((data) => {
                console.log('Response received');
                setWarehouseInventory(data);
            })
            .catch((error) => {
                console.error('There was a problem with the fetch operation:', error);
            })
    }, []);

    const getShelfAtPosition = (row, col) => {
        return hardCodeLayout.shelves.find(shelf => {
            const [startRow, startCol] = shelf["btm-lft"];
            const [height, width] = shelf["dim"];
            return (
                row >= startRow &&
                row < startRow + height &&
                col >= startCol &&
                col < startCol + width
            );
        });
    };

    const getColorForShelf = (shelf) => {
        if (!shelf) return 'white';
        
        const ratio = shelf.current / shelf.capacity;
        if (ratio === 0) return '#4CAF50';
        if (ratio === 1) return '#F44336'; 

        const hue = 60 - (ratio * 60); 
        return `hsl(${hue}, 100%, 50%)`;
    };

    const handleCellClick = (row, col) => {
        const shelf = getShelfAtPosition(row, col);
        if (shelf) {
            setSelectedShelf(shelf);
        }
    };

    const closeModal = () => {
        setSelectedShelf(null);
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Storage Management</h1>
            <p>Welcome to the Storage Management Interface.</p>
            
            <div style={{
                justifyContent: "center",
                width: "90%",
                display: 'grid',
                gridTemplateColumns: `repeat(${hardCodeLayout["grid-dim"][1]}, 40px)`,
                gap: '2px',
                margin: '0 auto'
            }}>
                {Array.from({ length: hardCodeLayout["grid-dim"][0] * hardCodeLayout["grid-dim"][1] }).map((_, index) => {
                    const row = Math.floor(index / hardCodeLayout["grid-dim"][1]);
                    const col = index % hardCodeLayout["grid-dim"][1];
                    const shelf = getShelfAtPosition(row, col);

                    return (
                        <div
                            key={index}
                            style={{
                                width: '40px',
                                height: '40px',
                                backgroundColor: getColorForShelf(shelf),
                                border: '0.5px solid black',
                                borderRadius: '5px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                cursor: shelf ? 'pointer' : 'default',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                            onClick={() => handleCellClick(row, col)}
                            title={shelf ? `Shelf ${shelf.name}\nCapacity: ${shelf.current}/${shelf.capacity}` : ''}
                        >
                            {shelf && row === shelf["btm-lft"][0] && col === shelf["btm-lft"][1] ? shelf.id : ''}
                        </div>
                    );
                })}
            </div>

            {}
            {selectedShelf && (
                <div style={{
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }} onClick={closeModal}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        width: '400px',
                        maxWidth: '90%',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                    }} onClick={e => e.stopPropagation()}>
                        <h2>Shelf Details</h2>
                        <div style={{ marginBottom: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span><strong>Name:</strong></span>
                                <span>{selectedShelf.name || `Shelf ${selectedShelf.id}`}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span><strong>Category:</strong></span>
                                <span>{selectedShelf.category || 'N/A'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span><strong>Location:</strong></span>
                                <span>Row {selectedShelf["btm-lft"][0]}, Col {selectedShelf["btm-lft"][1]}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span><strong>Dimensions:</strong></span>
                                <span>{selectedShelf.dim[0]}x{selectedShelf.dim[1]}</span>
                            </div>
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span><strong>Capacity:</strong></span>
                                <span>{selectedShelf.current} / {selectedShelf.capacity}</span>
                            </div>
                            <div style={{ width: '100%', height: '20px', backgroundColor: '#e0e0e0', borderRadius: '10px', marginTop: '5px' }}>
                                <div style={{
                                    width: `${(selectedShelf.current / selectedShelf.capacity) * 100}%`,
                                    height: '100%',
                                    backgroundColor: getColorForShelf(selectedShelf),
                                    borderRadius: '10px',
                                    transition: 'width 0.3s ease'
                                }}></div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={closeModal}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                float: 'right'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StorageGUI;