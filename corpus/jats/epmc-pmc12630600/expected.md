# Exploring potential hidden aspects of quantum field theory through numerical solution of the Klein–Gordon equation using the Yee algorithm

Babak Honarbakhsh  
*Scientific Reports*, 2025, 15, 40756  
DOI: 10.1038/s41598-025-24512-8 · PMID: 41258237 · PMCID: PMC12630600  
License: Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to…

## Abstract

This study presents a novel reformulation of the Klein–Gordon (KG) equation by embedding it within a system of first-order Maxwell–Heaviside (MH)-like equations, enabling its numerical solution using the finite-difference time-domain method based on the Yee algorithm. This approach extends the scalar KG field into a pair of fictitious Maxwellian vector fields. This reformulation not only provides an efficient computational framework, capable of handling nonlinearity and inhomogeneity, but also introduces a first-order structure with symmetric field dynamics. Plane-wave quantization of these fields reveals a conserved, non-negative quantity, forming what is termed Conserved Maxwellian Fields (CMFs), that addresses the longstanding issue of negative probability density in the conventional KG theory. Furthermore, the resulting CMFs exhibit deep structural analogies with Dirac spinors, particularly in three spatial dimensions, where only two CMF modes exist with monopole-like divergence. These findings bridge the gap between scalar field dynamics and electromagnetic field theory, offering both computational utility and potential insight into hidden structures in quantum field theory.

**Keywords:** Klein–Gordon equation, Maxwell–Heaviside equations, Finite‑difference time‑domain method, Yee algorithm, Conserved Maxwellian Fields, Quantum field theory

**Subject terms:** Mathematics and computing, Physics

## Introduction

The numerical solution of the Klein–Gordon (KG) equation has a long history and remains an active area of research[1–31]. Originally, the KG equation is a scalar, linear, homogeneous, constant-coefficient partial differential equation that is second-order in both space and time[32]. However, by relaxing the linearity constraint and allowing the coefficients to vary spatially, the KG equation can model a variety of physical phenomena, including solitary wave propagation in complex media[15]. In particular, the well-known sine–Gordon equation is a special case of a generalized KG equation[33].

Among the various numerical techniques, finite-difference (FD) schemes are not only simple to implement but also highly flexible, due to their straightforward handling of material inhomogeneities and nonlinearities. This makes them particularly well-suited for solving the KG equation in complex media. In fact, the application of numerical methods other than FD to the KG equation remains relatively rare[12,19,21].

Given that the likelihood of spurious solutions often increases with the order of the differential equation, it is natural to consider reformulating the KG equation as a system of first-order equations[34]. Notably, the mathematical form of the KG equation matches that of the inhomogeneous electromagnetic (EM) wave equation in the Lorenz gauge. This observation suggests that the Maxwell–Heaviside (MH) equations are a natural first-order candidate for such reformulation[35].

Accordingly, the KG equation can be embedded as one of six components within two fictitious Maxwellian vector. This construction is equivalent to extending the scalar KG field into a higher-dimensional Maxwellian field, whose domain and range fully encompass those of the original scalar field. In doing so, a conceptual bridge is established between the KG and MH equations, allowing the extensive numerical framework developed in computational electromagnetics (CEM) to be adapted for efficient solution of the KG equation. In particular, this enables the application of the widely used finite-difference time-domain (FDTD) method—a FD scheme based on the Yee algorithm[36,37]. The Yee Algorithm, introduced in 1966, is a cornerstone FDTD method for the numerical solution of Maxwell’s equations. It is built on a staggered grid in both space and time, often referred to as the Yee grid, where electric and magnetic field components are placed at alternating half-grid points. This ingenious arrangement allows for the derivatives in Maxwell’s equations to be approximated using second-order accurate central differences. The algorithm uses a leapfrog integration scheme, where the electric and magnetic fields are updated in an alternating fashion, staggered by half a time step. This structure makes the method explicit, numerically stable, and energy-conserving, leading to its widespread adoption for analyzing EM wave propagation, scattering, and resonance in complex materials and devices.

The aforesaid formulation introduces five auxiliary scalar fields in addition to the primary KG function. While these extra components currently lack direct physical interpretation, they may suggest unexplored structures or hidden degrees of freedom relevant to quantum field theory (QFT). The present work validates the feasibility of the proposed reformulation by implementing it using the Yee algorithm. Besides, through field quantization based on plane-wave solutions, a conservation law is shown to exist for a non-negative function. This resolves the long-standing issue of negative probability densities in KG. As well, in the plane-wave regime, the resulting Maxwellian fields exhibit complete symmetry, in the sense that both vector fields become non-solenoidal.

Two additional points are worth noting. First, the similarity between the KG and MH equations was recognized long ago by Alexandru Proca, who introduced what are now known as Proca fields to describe the dynamics of massive spin-1 particles[38]. However, the original Proca equations govern the four-potential and are second-order in both space and time, whereas the MH equations are first-order and act directly on the electric and magnetic fields. Furthermore, although the Proca equations can be expressed in terms of field quantities, they necessarily involve both scalar and vector potentials, and thus are not formulated purely in terms of electric and magnetic fields. Second, the term FDTD can, in principle, refer to any time-domain numerical method based on FD approximations, and many such variants have been applied to the KG equation. However, in the context of CEM, FDTD typically refers to a specific class of methods that solve the MH equations using the Yee algorithm for both spatial and temporal discretization, and its application to the KG equation in this manner is reported here for the first time. The rest of the paper organizes as follows: in section two, the most general form of the KG equation is expressed based on couple of curl equations as in the MH equations and sufficient time-domain equations for numerical solution of the KG equation is derived. Additionally, pseudo codes regarding FDTD implementation are included. Section three validates the proposed FDTD discretization to various test problems and concludes the numerical aspect of this paper. Sections four and five are devoted to the theoretical framework. Specifically, section four reformulates the original KG equation as a symmetric representation of all four MH equations. In this context, the concept of Conserved Maxwellian Fields (CMFs) is introduced, and it is shown how the source terms in the curl equations can be utilized to define such fields. Finally, section five derives plane-wave solutions for CMFs in one, two, and three spatial dimensions.

## Representing generalized Klein–Gordon equation by Maxwellian fields

The most general form of the KG equation is:

where is the speed of light in the medium, is a damping (or dissipation) coefficient, captures inhomogeneities in the medium, is, in general, a nonlinear function, and is an external forcing term[15]. Let 3D time-varying vector fields and satisfy:

wherein and can be regarded as the dual of and the source term, respectively. As long as numerical solution using the FDTD method is of interest, and are left unconstrained, since the Yee algorithm solves Maxwell’s curl equations. Additionally, let one of the Cartesian components of coincide with the KG field variable. Noting that the Cartesian components of the vector Laplacian operator are the same as the scalar Laplacian operator, the analogy between the MH and KG equation can be established if satisfies

wherein is a constant vector. Consequently, the vector extension of the KG equation is equivalent to the propagation of an EM wave within a complex medium that has field-dependent sources. Moreover, any general Maxwell solver can be utilized for the numerical solution of the KG equation. It is important to mention that there are auxiliary conditions associated to (2), including initial conditions (ICs). Specifally, let and . The imposition of the former is straightforward. To impose the later, it can be assumed that , leading to . Consequently, the time-domain equations that need to be discretized are:

The numerical solution of the KG equation in all dimensions is of particular interest, prompting further study of the specialized forms of Eq. (4). It is essential to highlight that although the FDTD method is easier to implement than other techniques, such as the Finite Element Method (FEM), there are two key factors that can significantly impact the accuracy of the solution if not properly addressed. The first factor is the order of the update equations. Mathematically, the arrangement of the equations in (4) is not important; however, from a numerical standpoint, the ordering is critical for obtaining accurate results. The second factor involves the Yee algorithm, which is based on central differences in both space and time. When represented using arrays, these differences become either forward or backward differences. Given the presence of an additional vector field in (4), the details of discretization are vital. Therefore, for each case, the relevant pseudocode for numerical implementation is provided, wherein it is assumed that and , for brevity. Also, in accordance with (4), “f” and “g” denote predefined functions representing nonlinearity and forcing functions.

### One-dimensional case

Let and . Then, and which simplifies (4) to:

In analogy with TEM waves, the above-mentioned solution can be regarded as a quantum wave. Especially, (5) becomes the Telegrapher’s equations governing a uniform lossy transmission line if [39]. The pseudocode corresponding to (5) is listed below.

### Two-dimensional case

Let and with . Then, and , leading to:

which is analog to the TE wave and can be called a wave. The pseudocode corresponding to (6) is listed below.

### Three-dimensional case

Let with . Then, and . Hence, (4) becomes:

The pseudocode corresponding to (7) is listed subsequently.

## Validation though numerical implementation

To assess the feasibility of the proposed representation of the KG equation from a computational perspective, various test problems (TPs) are numerically solved, as outlined in Table 1. The figure corresponding to the numerical solution of each problem matches the problem number, including figure 1-10. The boundary conditions (BCs) for the first five problems are Dirichlet, while the last five utilize homogeneous Neumann conditions. These correspond to the sine–Gordon equations, which include the collision of two circular ring solitons, a symmetrically perturbed static line soliton, a line soliton in a lossless inhomogeneous medium, a circular ring soliton, and the collision of two circular ring solitons[9]. In all problems, the weighting function is set to unity, except for test problem number eight, where . For cases where the exact solution is available, all auxiliary conditions can be derived from the solution and are omitted for brevity. Additionally, validation is conducted through a convergence analysis. For problems without an exact solution, readers are referred to the relevant references to verify the correctness of the solutions. Following the Courant–Friedrichs–Lewy (CFL) condition, the time step-sizes are chosen as follows: for 1D problems, for 2D, and for 3D problems. The number on nodes in the , , and dimensions are denoted by , , and , respectively, and are set equal to in all dimensions for both 2D and 3D problems. For convergence studies, the mean squared error (MSE) is calculated using , where and represent the analytical and numerical solutions, respectively (Figs. 1, 2, 3, 4, 5, 6, 7, 8, 9 and 10).

**Table 1.** Test problems for validating the proposed FDTD scheme for the Klein–Gordon equation.

| Test problem | Dimension |  |  |  |  | References |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 |  | 0 | 0 |  | [12] |
| 2 | 1 |  | 0 | 0 |  | [40] |
| 3 | 2 |  |  | 0 |  | [41] |
| 4 | 2 |  | 0 | 0 |  | [11] |
| 5 | 3 |  |  | 0 |  | [42] |
| 6–-10 | 2 |  | 0 | 0, 1.5 | NA | [9] |

**Fig. 1.** Convergence test for TP1.

**Fig. 2.** Convergence test for TP2.

**Fig. 3.** Convergence test for TP3.

**Fig. 4.** Convergence test for TP4.

**Fig. 5.** Convergence test for TP5 at

**Fig. 6.** Solution of TP6 with at : (**a**) 3D plot with , (**b**) 3D plot with , (**c**) contour plots.

**Fig. 7.** Solution of TP7 with at : (**a**) 3D plot with , (**b**) 3D plot with , (**c**) contour plots.

**Fig. 8.** Solution of TP8 with : (**a**) 3D plot at , (**b**) 3D plot at , (**c**) contour plots.

**Fig. 9.** Solution of TP9 with and : (**a**) 3D plot at , (**b**) 3D plot at , (**c**) 3D plot at , (**d**) contour plot at ,( **e**) contour plot at , (**f**) contour plot at .

**Fig. 10.** Solution of TP10 with and : (**a**) 3D plot at , (**b**) 3D plot at , (**c**) 3D plot at , (**d**) contour plot at ,(**e**) contour plot at , (**f**) contour plot at .

Numerical solutions for the first five TPs exhibit uniform convergence to the corresponding analytical solutions as the spatial grid is refined. In TP6 and TP7, an increase in the damping factor produces a progressive smoothing of the solution, which aligns with established physical intuition. TP9 and TP10 clearly display wave-like dynamics. Taken together, these results demonstrate that the proposed FDTD scheme is accurate, stable, and broadly applicable for the numerical solution of Klein–Gordon equations across a wide range of physical regimes.

## Representing the Klein–Gordon equation by symmetric Maxwellian fields

Similar to section two, the original form of the KG equation, given by

can be derived from Maxwellian vector fields. Specifically, consider the symmetric form of the MH equations that govern 3D complex-valued time-varying vector fields and :

wherein one of the Cartesian components of corresponds to the desired KG field variable. Unlike section two, divergences of the associated vector fields are also included, and the field may have more than one non-zero component. An analogy between the MH and KG equations can be established if the source terms and are selected such that:

As before, the terms and can be understood as EM sources, and it is possible to define them in a way that satisfies Eq. (10). Additionally, all the theorems and concepts related to time-harmonic electromagnetic fields apply to the Maxwellian representation of the original Klein–Gordon (KG) equation[35]. Specifically, based on the equivalence theorem and the solutions to the Helmholtz equations, which include cylindrical and spherical harmonics, it can be concluded that for sources of finite extent, the decay rates of and is at least proportional to and in two and three dimensions. Furthermore, in addition to , which serves as the dual vector field of , the proposed representation of the KG equation introduces new elements including:

wherein . Thus, if the source terms are such that vanishes, the Poynting theorem can serve as a desirable conservation law. Specifically, the non-negative scalar field may be a better choice than the conventional probability current density of the KG field.

The central issue which should be address is the existence of source terms that ensure the condition , which will be referred to as the *Fundamental Conservation Relation* (FCR) from now on. Furthermore, Maxwellian vector fields that satisfy this condition will be called *Conserved Maxwellian Fields* (CMF). The sufficient condition to ensure FCR is that , which is a simpler to work with. It is important to note that one can relate the source terms using the expression to construct CMFs. However, this choice may lead to singular solution due to zero crossings of . Additionally, this method may not be feasible if the primary interest lies in the plane-wave solution, as the resulting solution space may not be complete.

## Plane-wave solution of the Maxwellian Klein–Gordon equation

The most common solution type used to ensure completeness of the functional space is the plane-wave solution, which, for the original KG equation—i.e., (8)—takes the form:

with the dispersion relation given by . Here, denotes the imaginary unit, is the reduced Planck’s constant and is the particle mass[32]. The focus of this work will be on determining the coefficients such that the FCR holds. The coefficients can be obtained in a similar manner. It is worth noting that any field component beyond the scalar KG solution may represent a potential hidden aspect of QFT. Let the vector fields and be defined as:

where . By the linearity of (9), such expansions are valid. Furthermore, in view of the dispersion relation, (10) is automatically satisfied for this basis. Assume that the component of corresponds to the scalar KG field of interest. This requires for at least one . Additionally, let , , , , and . The goal is to determine , , , , and such that (13) satisfies the curl equations from (9), together with . This, in turn, determines and . It can be shown that is equivalent to

wherein . Clearly, (14) is a highly nonlinear equation, and thus, it would be informative to go through its solution step-by-step; from one to three dimensions, to construct the corresponding CMFs.

### CMF in one dimension

Let and . Then, (14) simplifies to:

Since the right-hand side contains a constant term, let and , where and are complex constants. Substituting these into (15), it can be verified that it holds provided and . Accordingly, for a given set of ,

This solution can be interpreted as an elliptically polarized quantum wave, propagating along the positive -axis. Notably, since the coefficients are arbitrary, there exists an infinite family of 1D solutions. However, if only the original KG scalar solution is of interest, one may choose , resulting in a linearly polarized wave and reducing the solution space to two. Thus, the scalar field taken as the component of , induces a corresponding single-component such that the pair form a 1D CMF. The fields are related via

wherein the subscript denotes the corresponding vector component. The aforesaid time-domain solution resembles TEM wave propagation in lossy media in the time-harmonic regime, with acting as a complex wave vector. Nevertheless, despite the difference in the solution domain, the fields are non-decaying propagating fields. Interestingly, the phase difference between the vector fields is proportional to the particle mass and vanishes for a massless particle, similar to the behavior of a TEM wave in unbounded, lossless media. Moreover, the ratio between transverse field components is , which duo to the dispersion relation, leads to

and mimics the wave impedance of a classical TEM mode in free space. Finally, the resulting CMF is symmetric, satisfying . An interested reader may verify the existence of an alternative 1D solution to Eq. (13) by assuming and . However, no solution exists for the case and .

### CMF in two dimensions

Let and , which simplifies (14) to:

Proceeding as in the 1D case, let and , where and are complex constants. Then, (19) holds if , and with satisfying . Consequently,

This solution can be interpreted as a linearly polarized quantum wave, propagating along the positive -axis. As in the 1D case, the number of 2D solutions is infinite, due to the arbitrary choice of on the circle defined by the mass constraint. Thus, the scalar KG field, represented by the components of , induces a two-component field , yielding a 2D CMF. The relationship between the fields can be compactly written as

wherein . Additionally, the impedance-like magnitude ratio satisfies:

Thus, both the magnitude and phase of the dual field are controlled by the position on the circle defined by . However, unlike the 1D case, the resulting CMF is not symmetric, because

Finally, one may verify that no other 2D solution exists for (16).

### CMF in three dimensions

A rather tedious algebraic analysis shows that no 3D CMF solution exists if or if both and . However, following the same strategy as in lower dimensions, two nontrivial 3D solutions are possible under asymmetric conditions.

*Case* 1. and .

Assume the auxiliary field relations , , and , wherein satisfies . Substituting into (14), one finds a valid solution if

The resulting fields are:

This solution introduces a fully 3D , and also adds a *y*-component to . Moreover,

and

*Case* 2. and .

Let , , and with the same constrain on as before. Then, (14) admits a solution for:

The fields then become:

This structure mirrors that of the previous case, leading to:

And

Thus, in contrast to 1D and 2D cases, each with infinite number of solutions, there are only two 3D solutions. Furthermore, similar to the 1D case, the resulting CMF is symmetric. Specifically, both of the vector fields of a 3D CMF have monopole sources. Another intriguing aspect of these solutions is their formal analogy with the plane‑wave spinors of the Dirac equation[43]. In the special case , one may identify the propagation direction with the spin quantization along the z-axis. Under this reduction (25) and (29) leads to:

and

Equations (32) and (33) exhibit a striking structural resemblance to the spin-up and spin-down solutions of the Dirac equation, particularly in their orthogonality and component organization. Like the mutually orthogonal, these solutions form an orthogonal set. Furthermore, each “spinor” in the proposed framework consists of a single-component dual field coupled with a two-component primary field , mirroring the way Dirac spinors for opposite spin projections distribute their non-zero momentum components along the quantization axis. This parallelism extends to antiparticles: the CMF solutions associated with the ​ coefficients exhibit a charge-conjugation-like duality, akin to the spinors in the Dirac theory.

## Discussion

As demonstrated, the Maxwellian reformulation of the KG equation not only offers an efficient computational framework for numerical analysis but also reveals deeper theoretical implications for QFT. Central to this reformulation is the emergence of a dialectical structure found in classical electromagnetism: the electric and magnetic fields mutually regenerate one another through temporal and spatial coupling. The embedded nature of Lenz’s law, which ensures that induced effects oppose their causes, further reinforces this interpretation of structural opposition. This dialectical character contrasts with the structure of traditional quantum equations such as the Schrödinger, KG, and Dirac equations, each of which involves only a single field variable and thus lacks internal dynamical interplay or “dialogue”[44]. In contrast, the Maxwellian framework comprises interacting field pairs that exhibit mutual causality. Viewed through a dialectical lens[45,46], one may interpret the electric field as a “thesis”, the magnetic field as its “antithesis”, and the energy flux described by the Poynting vector as the resulting “synthesis”. This self-regenerating, bidirectional structure presents a richer field dynamic that scalar formulations inherently lack.

This reformulation also invites reflection on the role of symmetry in physics and aesthetics. While symmetry is often considered a hallmark of beauty in both natural systems and physical theory[47], in practice, perfect symmetry is rarely—if ever—realized in macroscopic nature. Instead, partial or broken symmetry dominates, as observed in biological structures, crystal lattices, and cosmological distributions. Even in gauge theories and field models, spontaneous symmetry breaking is often essential to physical realism[48,49]. From this perspective, one may argue that dialectical balance more accurately reflects the elegance of nature than strict symmetry. Therefore, in the search for fundamental physical laws, it may be fruitful to focus on frameworks with interacting elements, such as those found in the Maxwellian field system, rather than isolated, symmetric scalar fields. Furthermore, it is well known that Dirac’s primary motivation in formulating his equation was to construct a relativistically consistent wave equation that is first-order in both space and time[50]—a property already realized in Maxwell’s equations. The symmetry exhibited in 3D CMFs introduced in this work is likewise partial: although the fields evolve in a structured and coupled manner, their divergence expressions are not identical, indicating incomplete symmetry. Rather than being a flaw, this asymmetry aligns with how nature operates.

Finally, the proposed analogy between plane-wave solutions of Dirac fields and the 3D CMFs, while conceptually intriguing, is not entirely unexpected. Both systems are governed by first-order differential equations in space and time and are associated with conservation laws of identical mathematical form. This resemblance reinforces the interpretive link between the proposed Maxwellian reformulation of the KG equation and the deeper structure of field theory.

## Conclusion

This work demonstrates that the KG equation can be reformulated as a first-order system analogous to MH equations, enabling its solution via a Yee-based FDTD method. The numerical scheme developed is validated across a range of linear and nonlinear test problems in one, two, and three dimensions, showing stability, accuracy, and versatility in complex media. Beyond numerical efficiency, the reformulation introduces the concept of CMFs, which satisfy a non-negative conservation law derived from plane-wave quantization. This provides a meaningful alternative to the problematic probability density interpretation of the KG field. In higher dimensions, especially in 3D, CMFs exhibit structural symmetry and divergence consistent with monopole-like sources, a feature absent from the original scalar formulation. Notably, the 3D CMF solutions exhibit formal analogies with Dirac spinors in both structure and conservation properties. This suggests a potential reinterpretation of scalar field equations in terms of more fundamental vector field dynamics and raises the possibility of previously unrecognized degrees of freedom. The proposed framework not only bridges classical electromagnetics with relativistic field theory but also opens new directions in numerical quantum field modeling and theoretical exploration.

## Acknowledgements

The author would like to thank the four anonymous reviewers for their constructive comments and the editorial board for managing the review process.

## Author contributions

The author, Babak Honarbakhsh, solely conceived the study, developed the theoretical framework, performed the numerical simulations, analyzed the results, and wrote the manuscript. All code implementations and figure generation were also carried out by the author.

## Funding

No funding was received for this work.

## Data availability

Data sets generated during the current study are available from the corresponding author on reasonable request.

## Code availability

The simulation codes used in this study are available from the corresponding author upon request.

## Declarations

### Competing interests

The authors declare no competing interests.

## Associated Data

### Data Availability Statement

Data sets generated during the current study are available from the corresponding author on reasonable request.

The simulation codes used in this study are available from the corresponding author upon request.

## Footnotes

- **✉** Corresponding author.
- **Publisher’s note** Springer Nature remains neutral with regard to jurisdictional claims in published maps and institutional affiliations.

## References

- [1] Strauss, W. & Vazquezf, L. Numerical solution of a nonlinear Klein–Gordon equation. J. Comput. Phys. 28, 271–278 (1978).
- [2] Gibbon, J. D., Freeman, N. C. & Davey, A. Three-dimensional multiple soliton-like solutions of non-linear Klein–Gordon equations. J. Phys. A: Math. Gen. 11(5), 93–96 (1978).
- [3] Christiansen, P. L. & Lomdahl, P. S. Numerical study of a 2 + 1dimensional sine-Gordon solitons. Physica D 2(3), 482–494 (1981).
- [4] Jimenez, S. & Vazquez, L. Analysis of four numerical schemes for a nonlinear Klein–Gordon equation. Appl. Math. Comput. 35, 61–94 (1990).
- [5] Djidjeli, K., Price, W. G. & Twizell, E. H. Numerical solutions of a damped Sine-Gordon equation in two space variables. J. Eng. Math. 29, 347–369 (1995).
- [6] Lynch, M. A. M. Large amplitude instability in finite difference approximations to the Klein-Gordon equation. Appl. Numer. Math. 31, 173–182 (1999).
- [7] Sheng, Q., Khaliq, A. Q. M. & Voss, D. A. Numerical simulation of two-dimensional sine-Gordon solitons via a split cosine scheme. Math. Comput. Simul. 68, 355–373 (2005).
- [8] Bratsos, A. G. A modified predictor–corrector scheme for the two-dimensional sine-Gordon equation. Numer. Algor. 43, 295–308 (2006).
- [9] Bratsos, A. G. The solution of the two-dimensional sine-Gordon equation using the method of lines. J. Comput. Appl. Math. 206, 251–277 (2007).
- [10] Dehghan, M. & Shokri, A. A numerical method for one-dimensional nonlinear sine-Gordon equation using collocation and radial basis functions. Numer. Methods Partial Diff. Equ. 24(2), 687–698 (2008).
- [11] Dehghan, M. & Shokri, A. A numerical method for solution of the two-dimensional sine-Gordon equation using the radial basis functions. Math. Comput. Simul. 79, 700–715 (2008).
- [12] Shakeri, F. & Dehghan, M. Numerical solution of the Klein–Gordon equation via He’s variational iteration method. Nonlinear Dyn. 51, 89–97 (2008).
- [13] Bratsos, A. G. On the numerical solution of the Klein–Gordon equation. Numer. Methods Partial Diff. Equ. 25(4), 939–951 (2009).
- [14] Dehghan, M., Mohebbi, A. & Asgari, Z. Fourth-order compact solution of the nonlinear Klein–Gordon equation. Numer. Algor. 52, 523–540 (2009).
- [15] Dehghan, M. & Shokri, A. Numerical solution of the nonlinear Klein–Gordon equation using radial basis functions. J. Comput. Appl. Math. 230, 400–410 (2009).
- [16] Zhang, F. & Han, B. The finite difference method for dissipative Klein–Gordon–Schrodinger equation in three space dimensions. J. Comput. Math. 28(6), 879–900 (2010).
- [17] Bao, W. & Dong, X. Analysis and comparison of numerical methods for the Klein–Gordon equation in the nonrelativistic limit regime. Numer. Math. 120, 189–229 (2012).
- [18] Verma, A., Jiwari, R. & Kumar, S. A numerical scheme based on differential quadrature method for numerical simulation of nonlinear Klein–Gordon equation. Int. J. Numer. Meth. Heat Fluid Flow 24(7), 1390–1404 (2014).
- [19] Kumar, D., Singh, J. & Kumar, S. Numerical computation of Klein–Gordon equations arising in quantum field theory by using homotopy analysis transform method. Alex. Eng. J. 53, 469–474 (2014).
- [20] Encinas, A. H. H., Martín-Vaquero, J., Queiruga-Dios, A. & Gayoso-Martínez, V. Efficient high-order finite difference methods for nonlinear Klein–Gordon equations. Nonlinear Anal.: Model. Control 20(2), 274–290 (2015).
- [21] Iqbal, J. & Abass, R. Numerical solution of Klein/sine-Gordon equations by spectral method coupled with Chebyshev wavelets. Appl. Math. 7, 2097–2109 (2016).
- [22] Ba, W. & Zhao, X. Comparison of numerical methods for the nonlinear Klein-Gordon equation in the nonrelativistic limit regime. J. Comput. Phys. 398, 108886 (2019).
- [23] Bao, W., Feng, Y. & Yi, W. Long time error analysis of finite difference time domain methods for the nonlinear Klein–Gordon equation with weak nonlinearity. Commun. Comput. Phys. 26(5), 1307–1334 (2019).
- [24] Ji, B. & Zhang, L. A dissipative finite difference Fourier pseudo-spectral method for the Klein-Gordon-Schrödinger equations with damping mechanism. Appl. Math. Comput. 376, 125148 (2020).
- [25] Zhang, T. & Wang, T. Optimal error estimates of fourth-order compact finite difference methods for the nonlinear Klein–Gordon equation in the nonrelativistic regime. Numer. Methods Partial Diff. Equ. 37(3), 2089–2108 (2021).
- [26] Yan, J., Zhang, H., Qian, X. & Song, S. Regularized finite difference methods for the logarithmic Klein–Gordon equation. East Asian J. Appl. Math. 11(1), 119–142 (2021).
- [27] Irk, D., Kirli, E. & Gorgulu, M. Z. A high order accurate numerical solution of the Klein-Gordon equation. Appl. Math. Inf. Sci. 16(2), 331–339 (2022).
- [28] Alzaleq, L. & Manoranjan, V. An energy conserving numerical scheme for the Klein–Gordon equation with cubic nonlinearity. Fractal Fract 6(8), 460–478 (2022).
- [29] Li, M., Ming, J., Qi, T. & Zhou, B. Convergence of an energy-preserving finite difference method for the nonlinear coupled space-fractional Klein–Gordon equations. Netw. Heterog. Med. 18(3), 957–981 (2023).
- [30] Mesgarani, H., Esmaeelzade Aghdam, Y. & Darabi, E. A new numerical method for discretization of the nonlinear Klein-Gordon model arising in light waves. J. Math. Model. 12(1), 71–84 (2024).
- [31] Cui, M. & Li, Y. Energy-conservative finite difference method for the coupled nonlinear Klein-Gordon equation in the nonrelativistic regime. Int. J. Numer. Anal. Model. 22(2), 246–267 (2025).
- [32] Klauber, R. Student Friendly Quantum Field Theory (Sandtrove Press, 2014).
- [33] Caudrey, P. J., Eilbeck, J. C. & Gibbon, J. D. The sine-Gordon equation as a model classical field theory. Nuovo Cimento B 25, 497–512 (1975).
- [34] Morton, K. W. & Mayers, D. F. Numerical Solution of Partial Differential Equations (Cambridge University Press, 2005).
- [35] Harrington, R. F. Time-Harmonic Electromagnetic Fields (Wiley-IEEE Press, 2001).
- [36] Yee, K. Numerical solution of initial boundary value problems involving maxwell’s equations in isotropic media. IEEE Trans. Antennas Propag. 14(3), 302–307 (1966).
- [37] Taflove, A. & Hagness, S. C. Computational Electrodynamics: The Finite-Difference Time-Domain Method (Artech House Inc, 2005).
- [38] Proca, Al. Sur la théorie ondulatoire des électrons positifs et négatifs. J. Phys. Radium 7(8), 347–353 (1936).
- [39] Pozar, D. M. Microwave Engineering 4th edn. (Wiley, 2011).
- [40] El-Sayed, S. M. The decomposition method for studying the Klein-Gordon equation. Chaos Solitons Fractals 18, 1025–1030 (2003).
- [41] Belayeh, W. G., Mussa, Y. O. & Gizaw, A. K. Approximate analytic solutions of two-dimensional nonlinear Klein–Gordon equation by using the reduced differential transform method. Math. Probl. Eng. 2020, 5753974 (2020).
- [42] Ibrahim, W. & Tamiru, M. Solutions of three-dimensional nonlinear Klein-Gordon equations by using quadruple Laplace transform. Int. J. Diff. Equ. 19, 2544576 (2022).
- [43] Greiner, W. Relativistic Quantum Mechanics (Springer, 2000).
- [44] Griffiths, D. J. Introduction to Quantum Mechanics 2nd edn. (Pearson Prentice Hall, 2004).
- [45] Hegel, G. W. F. Science of Logic, trans. A. V. Miller, Humanity Books, 1812–1816, (1999).
- [46] Engels, F. Dialectics of Nature 1873–1886 (Progress Publishers, 1976).
- [47] Wilczek, F. A Beautiful Question: Finding Nature’s Deep Design (Penguin Press, 2015).
- [48] Gross, D. The role of symmetry in fundamental physics. Proc. Natl. Acad. Sci. USA 93(25), 14256–14259 (1996).
- [49] Srednicki, M. Quantum Field Theory (Cambridge University Press, 2007).
- [50] Dirac, P. A. M. The Principles of Quantum Mechanics 4th edn. (Oxford University Press, 1958).
