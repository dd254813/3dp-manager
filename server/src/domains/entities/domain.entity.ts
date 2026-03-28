import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Domain {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ default: true })
  isEnabled: boolean;
}
