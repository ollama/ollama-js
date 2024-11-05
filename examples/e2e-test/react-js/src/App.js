import React, { useEffect, useState } from 'react';
import { Ollama } from 'ollama/browser';
import './App.css';

function App() {
  const ollama = new Ollama({ host: '[::1]:11434' })
  const [models, setModels] = useState([]);

  useEffect(() => {
    const fetchModels = async () => {
      const response = await ollama.list();
      console.log(response.models);
      setModels(response.models); // Store fetched models in state
    };

    fetchModels();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
      {models.length > 0 ? (
          <ul>
            {models.map((model, index) => (
              <li key={index}>{model.name}</li> // Example: Assuming each model has a 'name' property
            ))}
          </ul>
        ) : (
          <p>Loading models...</p>
        )}
      </header>
    </div>
  );
}

export default App;
