import React, { useState, useEffect } from 'react';
import { setLocalBackendUrl, getCurrentBackendUrl } from '../config';
import styled from 'styled-components';

const Container = styled.div`
  padding: 1rem;
  margin: 1rem 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f9f9f9;
`;

const CurrentConfig = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const ConfigToggle = styled.button`
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #0056b3;
  }
`;

const ConfigForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-weight: bold;
`;

const Input = styled.input`
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
`;

const SaveButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #218838;
  }
`;

const ResetButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #c82333;
  }
`;

const BackendConfig = () => {
    const [localUrl, setLocalUrl] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');
    const [isConfiguring, setIsConfiguring] = useState(false);

    useEffect(() => {
        // Get current backend URL on component mount
        setCurrentUrl(getCurrentBackendUrl());
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (localUrl) {
            // Remove trailing slash if present
            const cleanUrl = localUrl.replace(/\/$/, '');
            setLocalBackendUrl(cleanUrl);
            setCurrentUrl(getCurrentBackendUrl());
            setIsConfiguring(false);
            // Reload the page to apply new configuration
            window.location.reload();
        }
    };

    const handleReset = () => {
        localStorage.removeItem('localBackendUrl');
        setCurrentUrl(getCurrentBackendUrl());
        setIsConfiguring(false);
        // Reload the page to apply default configuration
        window.location.reload();
    };

    return (
        <Container>
            <CurrentConfig>
                <p>Current Backend URL: {currentUrl}</p>
                <ConfigToggle onClick={() => setIsConfiguring(!isConfiguring)}>
                    {isConfiguring ? 'Cancel' : 'Configure Backend URL'}
                </ConfigToggle>
            </CurrentConfig>

            {isConfiguring && (
                <ConfigForm onSubmit={handleSubmit}>
                    <FormGroup>
                        <Label htmlFor="localUrl">Backend URL:</Label>
                        <Input
                            type="text"
                            id="localUrl"
                            value={localUrl}
                            onChange={(e) => setLocalUrl(e.target.value)}
                            placeholder="http://localhost:5000"
                            required
                        />
                    </FormGroup>
                    <ButtonGroup>
                        <SaveButton type="submit">
                            Save Configuration
                        </SaveButton>
                        <ResetButton type="button" onClick={handleReset}>
                            Reset to Default
                        </ResetButton>
                    </ButtonGroup>
                </ConfigForm>
            )}
        </Container>
    );
};

export default BackendConfig; 