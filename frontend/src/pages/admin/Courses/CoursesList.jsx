import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody } from '../../../components/Card';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import AddCourseModal from './AddCourseModal';
import EditCourseModal from './EditCourseModal';
import { getCourses } from '../../../api/courses';

const TYPE_CHIP = {
  hifz:    { label: 'Hifz',    cls: 'chip chip-green' },
  nazra:   { label: 'Nazra',   cls: 'chip chip-blue'  },
  tajweed: { label: 'Tajweed', cls: 'chip chip-gold'  },
  arabic:  { label: 'Arabic',  cls: 'chip chip-sand'  },
};

const DIFFICULTY_CHIP = {
  beginner:     { label: 'Beginner',    cls: 'chip chip-green' },
  intermediate: { label: 'Intermediate', cls: 'chip chip-gold'  },
  advance:      { label: 'Advanced',    cls: 'chip chip-red'   },
};

function CourseCard({ course, onEdit }) {
  const navigate = useNavigate();
  const chip     = TYPE_CHIP[course.type] ?? { label: course.type, cls: 'chip chip-sand' };
  const diffChip = DIFFICULTY_CHIP[course.difficulty_level];

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CardBody style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className={chip.cls}>{chip.label}</span>
            {diffChip && <span className={diffChip.cls}>{diffChip.label}</span>}
          </div>
          {!course.is_active && (
            <span className="chip chip-red" style={{ fontSize: 10 }}>Inactive</span>
          )}
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3 }}>
          {course.name}
        </div>

        {course.name_ur && (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink-soft)', direction: 'rtl', textAlign: 'right', marginBottom: 8 }}>
            {course.name_ur}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>
          {course.duration_months && (
            <span>⏱ {course.duration_months} month{course.duration_months !== 1 ? 's' : ''}</span>
          )}
          {course.fee != null && (
            <span>₨ {Number(course.fee).toLocaleString()} PKR</span>
          )}
        </div>

        {course.description_ur && (
          <div style={{ fontSize: 12, color: 'var(--ink-pale)', direction: 'rtl', textAlign: 'right', flex: 1, marginBottom: 12, lineHeight: 1.6 }}>
            {course.description_ur}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--sand-mid)' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate(`/admin/courses/${course.id}`)}
            style={{ flex: 1 }}
          >
            Manage topics
          </Button>
          <Can permission="courses.edit">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(course)}
            >
              Edit
            </Button>
          </Can>
        </div>
      </CardBody>
    </Card>
  );
}

export default function CoursesList() {
  const [addOpen, setAddOpen]       = useState(false);
  const [editCourse, setEditCourse] = useState(null);

  const { data: courses = [], isLoading, error } = useQuery({
    queryKey: ['courses'],
    queryFn:  getCourses,
    staleTime: 2 * 60_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
        Failed to load courses.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            Courses
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {courses.length} course{courses.length !== 1 ? 's' : ''} in the curriculum
          </p>
        </div>
        <Can permission="courses.create">
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            + New course
          </Button>
        </Can>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No courses yet"
          description="Create the first course to get started with the curriculum."
          action={
            <Can permission="courses.create">
              <Button variant="primary" onClick={() => setAddOpen(true)}>+ New course</Button>
            </Can>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} onEdit={setEditCourse} />
          ))}
        </div>
      )}

      <AddCourseModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditCourseModal
        open={!!editCourse}
        course={editCourse}
        onClose={() => setEditCourse(null)}
      />
    </>
  );
}
