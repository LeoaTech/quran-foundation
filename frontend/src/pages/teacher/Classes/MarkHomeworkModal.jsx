import HomeworkGridModal from './HomeworkGridModal';

export default function MarkHomeworkModal({ open, onClose, classId, assignment, topic, readOnly = false }) {
  return (
    <HomeworkGridModal
      open={open}
      onClose={onClose}
      classId={classId}
      assignment={assignment || { title: topic?.topic_title || 'Homework Assignment' }}
      readOnly={readOnly}
    />
  );
}
