import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  margin: 20px 0;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  @media (prefers-color-scheme: dark) {
    background-color: #2d2d2d;
  }
`;

const Title = styled.h3`
  margin: 0 0 10px 0;
  color: #333;
  font-size: 1.1em;

  @media (prefers-color-scheme: dark) {
    color: #fff;
  }
`;

const HelpText = styled.p`
  color: #666;
  font-size: 0.9em;
  margin-bottom: 15px;

  @media (prefers-color-scheme: dark) {
    color: #aaa;
  }
`;

const SequenceList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const SequenceItem = styled.li`
  display: flex;
  align-items: center;
  padding: 10px;
  margin: 5px 0;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: move;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f0f0f0;
  }

  @media (prefers-color-scheme: dark) {
    background-color: #3d3d3d;
    border-color: #4d4d4d;

    &:hover {
      background-color: #4d4d4d;
    }
  }
`;

const SequenceNumber = styled.span`
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #007bff;
  color: white;
  border-radius: 50%;
  margin-right: 10px;
  font-weight: bold;
`;

const SequenceMonth = styled.span`
  flex-grow: 1;
  font-size: 1em;

  @media (prefers-color-scheme: dark) {
    color: #fff;
  }
`;

const DragHandle = styled.span`
  color: #999;
  font-size: 1.2em;
  cursor: move;
  padding: 0 10px;

  @media (prefers-color-scheme: dark) {
    color: #666;
  }
`;

const AttachmentSequence = ({ months, sequence, onSequenceChange }) => {
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const newSequence = [...sequence];
    const [movedItem] = newSequence.splice(sourceIndex, 1);
    newSequence.splice(targetIndex, 0, movedItem);
    onSequenceChange(newSequence);
  };

  return (
    <Container>
      <Title>Attachment Order</Title>
      <HelpText>Drag and drop to reorder attachments</HelpText>
      <SequenceList>
        {sequence.map((item, index) => (
          <SequenceItem
            key={`${item.month}-${item.year}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <SequenceNumber>{index + 1}</SequenceNumber>
            <SequenceMonth>{item.month} {item.year}</SequenceMonth>
            <DragHandle>⋮⋮</DragHandle>
          </SequenceItem>
        ))}
      </SequenceList>
    </Container>
  );
};

export default AttachmentSequence; 