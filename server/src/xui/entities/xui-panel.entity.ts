import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class XuiPanel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  url: string;

  @Column()
  login: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  host: string;

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  geoCountry: string;

  @Column({ nullable: true })
  geoFlag: string;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: false })
  hysteriaEnabled: boolean;

  @Column({ nullable: true })
  hysteriaHost: string | null;

  @Column({ nullable: true })
  hysteriaPort: number | null;

  @Column({ nullable: true })
  hysteriaPassword: string | null;

  @Column({ nullable: true })
  hysteriaObfsPassword: string | null;

  @Column({ nullable: true })
  hysteriaSni: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
